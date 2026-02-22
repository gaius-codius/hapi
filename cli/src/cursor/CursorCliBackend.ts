import { randomUUID } from 'node:crypto';
import { spawn, type ChildProcess } from 'node:child_process';
import { logger } from '@/ui/logger';
import { killProcessByChildProcess } from '@/utils/process';
import type {
    AgentBackend,
    AgentMessage,
    AgentSessionConfig,
    PermissionRequest,
    PermissionResponse,
    PromptContent
} from '@/agent/types';

type CursorCliBackendOptions = {
    model?: string;
    resumeSessionId?: string;
    forceWrites?: boolean;
    extraArgs?: string[];
};

type StreamEvent = {
    type?: unknown;
    subtype?: unknown;
    session_id?: unknown;
    call_id?: unknown;
    tool_call?: unknown;
    message?: unknown;
    result?: unknown;
    is_error?: unknown;
};

function toText(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function buildPromptText(content: PromptContent[]): string {
    const parts = content
        .filter((item) => item.type === 'text')
        .map((item) => item.text.trim())
        .filter(Boolean);
    return parts.join('\n\n');
}

function normalizeToolName(key: string): string {
    const trimmed = key.endsWith('ToolCall') ? key.slice(0, -'ToolCall'.length) : key;
    if (!trimmed) {
        return 'CursorTool';
    }
    return `Cursor${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
}

function extractAssistantText(message: unknown): string | null {
    const msgRecord = asRecord(message);
    const content = msgRecord?.content;
    if (!Array.isArray(content)) {
        return null;
    }
    const chunks = content
        .map((item) => {
            const record = asRecord(item);
            return record?.type === 'text' ? toText(record.text) : null;
        })
        .filter((chunk): chunk is string => Boolean(chunk));
    if (chunks.length === 0) {
        return null;
    }
    return chunks.join('\n');
}

export class CursorCliBackend implements AgentBackend {
    private readonly sessionConfigById = new Map<string, AgentSessionConfig>();
    private currentProcess: ChildProcess | null = null;
    private activeCursorSessionId: string | null;
    private permissionRequestHandler: ((request: PermissionRequest) => void) | null = null;

    constructor(private readonly options: CursorCliBackendOptions) {
        this.activeCursorSessionId = options.resumeSessionId ?? null;
    }

    getActiveSessionId(): string | null {
        return this.activeCursorSessionId;
    }

    async initialize(): Promise<void> {
        return;
    }

    async newSession(config: AgentSessionConfig): Promise<string> {
        const sessionId = randomUUID();
        this.sessionConfigById.set(sessionId, config);
        return sessionId;
    }

    async prompt(
        sessionId: string,
        content: PromptContent[],
        onUpdate: (msg: AgentMessage) => void
    ): Promise<void> {
        const config = this.sessionConfigById.get(sessionId);
        if (!config) {
            throw new Error('Cursor session not initialized');
        }

        const prompt = buildPromptText(content);
        if (!prompt) {
            onUpdate({ type: 'turn_complete', stopReason: 'empty_prompt' });
            return;
        }

        const args: string[] = ['--print', '--output-format', 'stream-json'];
        if (this.options.model) {
            args.push('--model', this.options.model);
        }
        if (this.options.forceWrites !== false) {
            args.push('--force');
        }
        if (this.activeCursorSessionId) {
            args.push(`--resume=${this.activeCursorSessionId}`);
        }
        if (this.options.extraArgs && this.options.extraArgs.length > 0) {
            args.push(...this.options.extraArgs);
        }
        args.push('-p', prompt);

        let stderrTail = '';
        let stdoutBuffer = '';
        let finalText: string | null = null;
        let assistantFallback: string | null = null;

        const handleStreamLine = (line: string) => {
            let event: StreamEvent;
            try {
                event = JSON.parse(line) as StreamEvent;
            } catch {
                return;
            }

            const eventType = toText(event.type);
            if (!eventType) {
                return;
            }

            const sessionIdFromEvent = toText(event.session_id);
            if (sessionIdFromEvent) {
                this.activeCursorSessionId = sessionIdFromEvent;
            }

            if (eventType === 'assistant') {
                const assistantText = extractAssistantText(event.message);
                if (assistantText) {
                    assistantFallback = assistantText;
                }
                return;
            }

            if (eventType === 'tool_call') {
                const subtype = toText(event.subtype);
                const callId = toText(event.call_id) ?? randomUUID();
                const toolCall = asRecord(event.tool_call);
                const toolEntry = toolCall ? Object.entries(toolCall)[0] : undefined;
                if (!toolEntry) {
                    return;
                }

                const [toolKey, rawPayload] = toolEntry;
                const toolName = normalizeToolName(toolKey);
                const payload = asRecord(rawPayload) ?? {};
                const toolArgs = payload.args ?? payload;

                if (subtype === 'started') {
                    onUpdate({
                        type: 'tool_call',
                        id: callId,
                        name: toolName,
                        input: toolArgs,
                        status: 'in_progress'
                    });
                    return;
                }

                if (subtype === 'completed') {
                    onUpdate({
                        type: 'tool_result',
                        id: callId,
                        output: payload.result ?? payload,
                        status: 'completed'
                    });
                }
                return;
            }

            if (eventType === 'result') {
                finalText = toText(event.result) ?? finalText;
            }
        };

        await new Promise<void>((resolve, reject) => {
            const child = spawn('agent', args, {
                cwd: config.cwd,
                env: process.env,
                stdio: ['ignore', 'pipe', 'pipe'],
                shell: process.platform === 'win32'
            });
            this.currentProcess = child;

            child.stdout?.on('data', (chunk) => {
                stdoutBuffer += chunk.toString();
                let newlineIndex = stdoutBuffer.indexOf('\n');
                while (newlineIndex !== -1) {
                    const line = stdoutBuffer.slice(0, newlineIndex).trim();
                    stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
                    if (line.length > 0) {
                        handleStreamLine(line);
                    }
                    newlineIndex = stdoutBuffer.indexOf('\n');
                }
            });

            child.stderr?.on('data', (chunk) => {
                const text = chunk.toString();
                if (!text) {
                    return;
                }
                const combined = `${stderrTail}${text}`;
                stderrTail = combined.length > 4000 ? combined.slice(-4000) : combined;
            });

            child.on('error', (error) => {
                const message = error instanceof Error ? error.message : String(error);
                reject(new Error(`Failed to spawn Cursor CLI: ${message}`));
            });

            child.on('exit', (code, signal) => {
                this.currentProcess = null;
                if (stdoutBuffer.trim().length > 0) {
                    handleStreamLine(stdoutBuffer.trim());
                }
                if (code === 0 && !signal) {
                    resolve();
                    return;
                }
                const detail = stderrTail.trim();
                reject(new Error(
                    `Cursor CLI exited unexpectedly (code=${code ?? 'null'}, signal=${signal ?? 'null'})`
                    + (detail ? `\n${detail}` : '')
                ));
            });
        });

        const text = finalText ?? assistantFallback;
        if (text) {
            onUpdate({ type: 'text', text });
        }
        onUpdate({ type: 'turn_complete', stopReason: 'completed' });
    }

    async cancelPrompt(_sessionId: string): Promise<void> {
        const current = this.currentProcess;
        if (!current) {
            return;
        }
        this.currentProcess = null;
        try {
            await killProcessByChildProcess(current, true);
        } catch (error) {
            logger.debug('[cursor] Failed to cancel Cursor CLI prompt', error);
        }
    }

    async respondToPermission(
        _sessionId: string,
        _request: PermissionRequest,
        _response: PermissionResponse
    ): Promise<void> {
        return;
    }

    onPermissionRequest(handler: (request: PermissionRequest) => void): void {
        this.permissionRequestHandler = handler;
        void this.permissionRequestHandler;
    }

    async disconnect(): Promise<void> {
        if (!this.currentProcess) {
            return;
        }
        const current = this.currentProcess;
        this.currentProcess = null;
        try {
            await killProcessByChildProcess(current, true);
        } catch (error) {
            logger.debug('[cursor] Failed to stop Cursor CLI process', error);
        }
    }
}
