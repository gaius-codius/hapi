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

function renderHeader(sessionOverrides: Record<string, unknown> = {}) {
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
        ...sessionOverrides
    } as any

    return renderToStaticMarkup(
        <I18nProvider>
            <SessionHeader
                session={session}
                onBack={vi.fn()}
                api={null}
            />
        </I18nProvider>
    )
}

describe('SessionHeader', () => {
    it('shows the full colored-text metadata set', () => {
        const html = renderHeader()

        expect(html).toContain('Claude session')
        expect(html).toContain('claude')
        expect(html).toContain('gpt-5.4')
        expect(html).toContain('High Effort')
        expect(html).toContain('Plan Mode')
        expect(html).toContain('feature/header-glanceability')
        expect(html).not.toContain('❖')
    })

    it('hides effort when absent', () => {
        const html = renderHeader({ effort: null })
        expect(html).not.toContain('High Effort')
    })

    it('hides permission mode when set to default', () => {
        const html = renderHeader({ permissionMode: 'default' })
        expect(html).not.toContain('Plan Mode')
    })

    it('hides worktree branch when absent', () => {
        const html = renderHeader({
            metadata: {
                name: 'No worktree',
                flavor: 'claude',
                path: '/repo/app'
            }
        })
        expect(html).not.toContain('feature/')
    })

    it('falls back to path-derived title when name is missing', () => {
        const html = renderHeader({
            metadata: {
                flavor: 'claude',
                path: '/repo/my-project'
            }
        })
        expect(html).toContain('my-project')
    })

    it('falls back to sliced id when metadata is missing', () => {
        const html = renderHeader({
            id: 'abcdef1234567890',
            metadata: null
        })
        expect(html).toContain('abcdef12')
    })

    it('shows unknown for missing flavor', () => {
        const html = renderHeader({
            metadata: {
                name: 'No flavor',
                path: '/repo/app'
            }
        })
        expect(html).toContain('unknown')
    })
})
