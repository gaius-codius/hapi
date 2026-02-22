import { AgentRegistry } from '@/agent/AgentRegistry';
import { CursorCliBackend } from '@/cursor/CursorCliBackend';

export type CursorRunnerOptions = {
    model?: string;
    resumeSessionId?: string;
    yolo?: boolean;
    cursorArgs?: string[];
};

export function registerCursorAgent(options: CursorRunnerOptions = {}): void {
    AgentRegistry.register('cursor', () => new CursorCliBackend({
        model: options.model,
        resumeSessionId: options.resumeSessionId,
        forceWrites: options.yolo === true ? true : undefined,
        extraArgs: options.cursorArgs
    }));
}
