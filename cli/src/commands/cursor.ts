import chalk from 'chalk'
import { authAndSetupMachineIfNeeded } from '@/ui/auth'
import { initializeToken } from '@/ui/tokenInit'
import { maybeAutoStartServer } from '@/utils/autoStartServer'
import type { CommandDefinition } from './types'

export const cursorCommand: CommandDefinition = {
    name: 'cursor',
    requiresRuntimeAssets: true,
    run: async ({ commandArgs }) => {
        try {
            const options: {
                startedBy?: 'runner' | 'terminal'
                model?: string
                resumeSessionId?: string
                cursorArgs?: string[]
            } = {}
            const passthroughArgs: string[] = []

            for (let i = 0; i < commandArgs.length; i++) {
                const arg = commandArgs[i]
                if (arg === '--started-by') {
                    options.startedBy = commandArgs[++i] as 'runner' | 'terminal'
                } else if (arg === '--yolo') {
                    // Cursor mode always runs in print mode with --force. Keep the flag for compatibility.
                    continue
                } else if (arg === '--model') {
                    const model = commandArgs[++i]
                    if (!model) {
                        throw new Error('Missing --model value')
                    }
                    options.model = model
                } else if (arg === '--resume') {
                    const resumeSessionId = commandArgs[++i]
                    if (!resumeSessionId) {
                        throw new Error('Missing --resume value')
                    }
                    options.resumeSessionId = resumeSessionId
                } else if (arg === '--hapi-starting-mode') {
                    // Cursor integration is remote-only; consume this runner flag without forwarding it.
                    i += 1
                } else {
                    passthroughArgs.push(arg)
                }
            }

            if (passthroughArgs.length > 0) {
                options.cursorArgs = passthroughArgs
            }

            await initializeToken()
            await maybeAutoStartServer()
            await authAndSetupMachineIfNeeded()

            const { runCursor } = await import('@/cursor/runCursor')
            await runCursor(options)
        } catch (error) {
            console.error(chalk.red('Error:'), error instanceof Error ? error.message : 'Unknown error')
            if (process.env.DEBUG) {
                console.error(error)
            }
            process.exit(1)
        }
    }
}
