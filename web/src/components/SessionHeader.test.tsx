import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nProvider } from '@/lib/i18n-context'
import { SessionHeader } from './SessionHeader'

vi.mock('@/hooks/useTelegram', () => ({
    isTelegramApp: () => false
}))

vi.mock('@/hooks/mutations/useSessionActions', () => ({
    useSessionActions: () => ({
        archiveSession: vi.fn(),
        renameSession: vi.fn(),
        deleteSession: vi.fn(),
        isPending: false
    })
}))

vi.mock('@/components/SessionActionMenu', () => ({ SessionActionMenu: () => null }))
vi.mock('@/components/RenameSessionDialog', () => ({ RenameSessionDialog: () => null }))
vi.mock('@/components/ui/ConfirmDialog', () => ({ ConfirmDialog: () => null }))

describe('SessionHeader', () => {
    it('shows the full colored-text metadata set', () => {
        const session = {
            id: 'session-2',
            active: true,
            updatedAt: Date.now(),
            model: 'gpt-5.4',
            effort: 'high-effort',
            permissionMode: 'plan',
            metadata: {
                name: 'Claude session',
                flavor: 'claude',
                path: '/repo/app',
                worktree: {
                    branch: 'feature/header-glanceability'
                }
            },
            todoProgress: {
                completed: 4,
                total: 6
            }
        } as any

        const html = renderToStaticMarkup(
            <I18nProvider>
                <SessionHeader
                    session={session}
                    onBack={vi.fn()}
                    api={null}
                />
            </I18nProvider>
        )

        expect(html).toContain('Claude session')
        expect(html).toContain('claude')
        expect(html).toContain('gpt-5.4')
        expect(html).toContain('High Effort')
        expect(html).toContain('Plan Mode')
        expect(html).toContain('feature/header-glanceability')
        expect(html).toContain('4/6')
        expect(html).not.toContain('❖')
    })
})
