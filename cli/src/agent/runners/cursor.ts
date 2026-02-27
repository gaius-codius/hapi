import { AgentRegistry } from '@/agent/AgentRegistry';
import { CursorCliBackend } from '@/cursor/CursorCliBackend';

export type CursorRunnerOptions = {
    model?: string;
    resumeSessionId?: string;
    cursorArgs?: string[];
};

export function registerCursorAgent(options: CursorRunnerOptions = {}): void {
    AgentRegistry.register('cursor', () => new CursorCliBackend({
        model: options.model,
        resumeSessionId: options.resumeSessionId,
        extraArgs: options.cursorArgs
    }));
}
