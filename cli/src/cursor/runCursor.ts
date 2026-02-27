import { runAgentSession } from '@/agent/runners/runAgentSession';
import { registerCursorAgent } from '@/agent/runners/cursor';

export async function runCursor(opts: {
    startedBy?: 'runner' | 'terminal';
    model?: string;
    resumeSessionId?: string;
    cursorArgs?: string[];
} = {}): Promise<void> {
    registerCursorAgent({
        model: opts.model,
        resumeSessionId: opts.resumeSessionId,
        cursorArgs: opts.cursorArgs
    });

    await runAgentSession({
        agentType: 'cursor',
        startedBy: opts.startedBy
    });
}
