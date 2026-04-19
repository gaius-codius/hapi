import { describe, expect, it } from 'vitest'
import type { SessionSummary } from '@/types/api'
import { UNKNOWN_MACHINE_ID, groupSessionsByDirectory } from './SessionList'

function makeSession(overrides: Partial<SessionSummary> = {}): SessionSummary {
    return {
        id: 'session-1',
        active: false,
        thinking: false,
        activeAt: 0,
        updatedAt: 0,
        metadata: {
            path: '/workspace/project',
            machineId: 'machine-a'
        },
        todoProgress: null,
        pendingRequestsCount: 0,
        model: null,
        effort: null,
        ...overrides
    }
}

describe('groupSessionsByDirectory', () => {
    it('groups by machine and directory', () => {
        const groups = groupSessionsByDirectory([
            makeSession({ id: 'session-a', metadata: { path: '/workspace/project', machineId: 'machine-a' } }),
            makeSession({ id: 'session-b', metadata: { path: '/workspace/project', machineId: 'machine-b' } })
        ])

        expect(groups).toHaveLength(2)
        expect(groups.map(group => group.key)).toEqual([
            'machine-a::/workspace/project',
            'machine-b::/workspace/project'
        ])
    })

    it('sorts active sessions before inactive sessions within a group', () => {
        const [group] = groupSessionsByDirectory([
            makeSession({ id: 'inactive', active: false, updatedAt: 20 }),
            makeSession({ id: 'active', active: true, updatedAt: 10 })
        ])

        expect(group.sessions.map(session => session.id)).toEqual(['active', 'inactive'])
    })

    it('ranks active sessions with pending requests ahead of other active sessions', () => {
        const [group] = groupSessionsByDirectory([
            makeSession({ id: 'active-no-pending', active: true, updatedAt: 30, pendingRequestsCount: 0 }),
            makeSession({ id: 'active-pending', active: true, updatedAt: 10, pendingRequestsCount: 2 })
        ])

        expect(group.sessions.map(session => session.id)).toEqual(['active-pending', 'active-no-pending'])
    })

    it('sorts groups with active sessions ahead of inactive groups', () => {
        const groups = groupSessionsByDirectory([
            makeSession({
                id: 'inactive-group',
                updatedAt: 100,
                metadata: { path: '/workspace/inactive', machineId: 'machine-a' }
            }),
            makeSession({
                id: 'active-group',
                active: true,
                updatedAt: 10,
                metadata: { path: '/workspace/active', machineId: 'machine-a' }
            })
        ])

        expect(groups.map(group => group.directory)).toEqual([
            '/workspace/active',
            '/workspace/inactive'
        ])
    })

    it('groups worktree sessions by basePath', () => {
        const [group] = groupSessionsByDirectory([
            makeSession({
                id: 'worktree-a',
                metadata: {
                    path: '/workspace/project-worktrees/feature-a',
                    machineId: 'machine-a',
                    worktree: {
                        branch: 'feature-a',
                        basePath: '/workspace/project',
                        name: 'feature-a'
                    }
                }
            }),
            makeSession({
                id: 'worktree-b',
                metadata: {
                    path: '/workspace/project-worktrees/feature-b',
                    machineId: 'machine-a',
                    worktree: {
                        branch: 'feature-b',
                        basePath: '/workspace/project',
                        name: 'feature-b'
                    }
                }
            })
        ])

        expect(group.directory).toBe('/workspace/project')
        expect(group.key).toBe('machine-a::/workspace/project')
        expect(group.sessions).toHaveLength(2)
    })

    it('uses the Other fallback when path metadata is missing', () => {
        const [group] = groupSessionsByDirectory([
            makeSession({
                id: 'no-path',
                metadata: {
                    machineId: undefined
                } as SessionSummary['metadata']
            })
        ])

        expect(group.directory).toBe('Other')
        expect(group.key).toBe(`${UNKNOWN_MACHINE_ID}::Other`)
    })

    it('derives compact display names from the directory path', () => {
        const [group] = groupSessionsByDirectory([
            makeSession({
                metadata: {
                    path: '/Users/dev/projects/hapi',
                    machineId: 'machine-a'
                }
            })
        ])

        expect(group.displayName).toBe('projects/hapi')
    })
})
