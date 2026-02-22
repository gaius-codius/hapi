import { runAgentSession } from '@/agent/runners/runAgentSession';
import { registerCursorAgent } from '@/agent/runners/cursor';

export async function runCursor(opts: {
    startedBy?: 'runner' | 'terminal';
    model?: string;
    yolo?: boolean;
    resumeSessionId?: string;
    cursorArgs?: string[];
} = {}): Promise<void> {
    registerCursorAgent({
        model: opts.model,
        resumeSessionId: opts.resumeSessionId,
        yolo: opts.yolo,
        cursorArgs: opts.cursorArgs
    });

    await runAgentSession({
        agentType: 'cursor',
        startedBy: opts.startedBy
    });
}
