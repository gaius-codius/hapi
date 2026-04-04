import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nProvider } from '@/lib/i18n-context'
import { SessionList } from './SessionList'

vi.mock('@/hooks/useLongPress', () => ({
    useLongPress: () => ({})
}))

vi.mock('@/hooks/usePlatform', () => ({
    usePlatform: () => ({
        haptic: {
            impact: vi.fn()
        }
    })
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

describe('SessionList', () => {
    it('shows glanceable metadata, dims inactive text, and skips disallowed permission mode', () => {
        const session = {
            id: 'session-1',
            active: false,
            thinking: false,
            pendingRequestsCount: 0,
            updatedAt: Date.now(),
            model: 'gpt-5.4',
            effort: 'high-effort',
            permissionMode: 'plan',
            metadata: {
                name: 'Inactive codex session',
                flavor: 'codex',
                machineId: 'machine-1',
                path: '/repo/app',
                worktree: {
                    basePath: '/repo',
                    branch: 'feature/list-glanceability'
                }
            },
            todoProgress: {
                completed: 3,
                total: 5
            }
        } as any

        const activeSession = {
            id: 'session-2',
            active: true,
            thinking: false,
            pendingRequestsCount: 0,
            updatedAt: Date.now(),
            model: 'gpt-5.4',
            metadata: {
                name: 'Active helper session',
                flavor: 'claude',
                machineId: 'machine-1',
                path: '/repo/app',
                worktree: {
                    basePath: '/repo',
                    branch: 'feature/helper'
                }
            }
        } as any

        const html = renderToStaticMarkup(
            <I18nProvider>
                <SessionList
                    sessions={[activeSession, session]}
                    onSelect={vi.fn()}
                    onNewSession={vi.fn()}
                    onRefresh={vi.fn()}
                    isLoading={false}
                    renderHeader={false}
                    api={null}
                    machineLabelsById={{ 'machine-1': 'Desk Mac' }}
                />
            </I18nProvider>
        )

        expect(html).toContain('Inactive codex session')
        expect(html).toContain('codex')
        expect(html).toContain('gpt-5.4')
        expect(html).toContain('feature/list-glanceability')
        expect(html).toContain('3/5')
        expect(html).toContain('Desk Mac')
        expect(html).toContain('High Effort')
        expect(html).not.toContain('Plan Mode')
        expect(html).toContain('opacity-[0.55]')
    })

    it('shows allowed permission mode for claude sessions', () => {
        const session = {
            id: 'session-plan',
            active: true,
            thinking: false,
            pendingRequestsCount: 0,
            updatedAt: Date.now(),
            model: 'claude-sonnet',
            permissionMode: 'plan',
            metadata: {
                name: 'Planned session',
                flavor: 'claude',
                machineId: 'machine-1',
                path: '/repo/app',
                worktree: { basePath: '/repo', branch: 'main' }
            }
        } as any

        const html = renderToStaticMarkup(
            <I18nProvider>
                <SessionList
                    sessions={[session]}
                    onSelect={vi.fn()}
                    onNewSession={vi.fn()}
                    onRefresh={vi.fn()}
                    isLoading={false}
                    renderHeader={false}
                    api={null}
                    machineLabelsById={{ 'machine-1': 'Mac' }}
                />
            </I18nProvider>
        )

        expect(html).toContain('Plan Mode')
    })

    it('hides todo progress when completed equals total', () => {
        const session = {
            id: 'session-done',
            active: true,
            thinking: false,
            pendingRequestsCount: 0,
            updatedAt: Date.now(),
            model: 'claude-sonnet',
            metadata: {
                name: 'Done session',
                flavor: 'claude',
                machineId: 'machine-1',
                path: '/repo/app',
                worktree: { basePath: '/repo', branch: 'main' }
            },
            todoProgress: {
                completed: 5,
                total: 5
            }
        } as any

        const html = renderToStaticMarkup(
            <I18nProvider>
                <SessionList
                    sessions={[session]}
                    onSelect={vi.fn()}
                    onNewSession={vi.fn()}
                    onRefresh={vi.fn()}
                    isLoading={false}
                    renderHeader={false}
                    api={null}
                    machineLabelsById={{ 'machine-1': 'Mac' }}
                />
            </I18nProvider>
        )

        expect(html).not.toContain('5/5')
    })

    it('shows effort label when present', () => {
        const session = {
            id: 'session-effort',
            active: true,
            thinking: false,
            pendingRequestsCount: 0,
            updatedAt: Date.now(),
            model: 'claude-sonnet',
            effort: 'low-effort',
            metadata: {
                name: 'Effort session',
                flavor: 'claude',
                machineId: 'machine-1',
                path: '/repo/app',
                worktree: { basePath: '/repo', branch: 'main' }
            }
        } as any

        const html = renderToStaticMarkup(
            <I18nProvider>
                <SessionList
                    sessions={[session]}
                    onSelect={vi.fn()}
                    onNewSession={vi.fn()}
                    onRefresh={vi.fn()}
                    isLoading={false}
                    renderHeader={false}
                    api={null}
                    machineLabelsById={{ 'machine-1': 'Mac' }}
                />
            </I18nProvider>
        )

        expect(html).toContain('Low Effort')
    })
})
