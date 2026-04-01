import { useEffect, useMemo, useRef, useState } from 'react'
import type { SessionSummary } from '@/types/api'
import type { ApiClient } from '@/api/client'
import { useLongPress } from '@/hooks/useLongPress'
import { usePlatform } from '@/hooks/usePlatform'
import { useSessionActions } from '@/hooks/mutations/useSessionActions'
import { SessionActionMenu } from '@/components/SessionActionMenu'
import { RenameSessionDialog } from '@/components/RenameSessionDialog'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { SESSION_ACTIVITY_BADGE, SESSION_PENDING_BADGE, getFlavorTextClass, formatEffortLabel, META_DOT_SEPARATOR_CLASS } from '@/lib/agentFlavorUtils'
import { getSessionModelLabel } from '@/lib/sessionModelLabel'
import { useTranslation } from '@/lib/use-translation'

type SessionGroup = {
    key: string
    directory: string
    displayName: string
    machineId: string | null
    sessions: SessionSummary[]
    latestUpdatedAt: number
    hasActiveSession: boolean
}

function getGroupDisplayName(directory: string): string {
    if (directory === 'Other') return directory
    const parts = directory.split(/[\\/]+/).filter(Boolean)
    if (parts.length === 0) return directory
    if (parts.length === 1) return parts[0]
    return `${parts[parts.length - 2]}/${parts[parts.length - 1]}`
}

function groupSessionsByDirectory(sessions: SessionSummary[]): SessionGroup[] {
    const groups = new Map<string, { directory: string; machineId: string | null; sessions: SessionSummary[] }>()

    sessions.forEach(session => {
        const path = session.metadata?.worktree?.basePath ?? session.metadata?.path ?? 'Other'
        const machineId = session.metadata?.machineId ?? null
        const key = `${machineId ?? '__unknown__'}::${path}`
        if (!groups.has(key)) {
            groups.set(key, { directory: path, machineId, sessions: [] })
        }
        groups.get(key)!.sessions.push(session)
    })

    return Array.from(groups.entries())
        .map(([key, group]) => {
            const sortedSessions = [...group.sessions].sort((a, b) => {
                const rankA = a.active ? (a.pendingRequestsCount > 0 ? 0 : 1) : 2
                const rankB = b.active ? (b.pendingRequestsCount > 0 ? 0 : 1) : 2
                if (rankA !== rankB) return rankA - rankB
                return b.updatedAt - a.updatedAt
            })
            const latestUpdatedAt = group.sessions.reduce(
                (max, s) => (s.updatedAt > max ? s.updatedAt : max),
                -Infinity
            )
            const hasActiveSession = group.sessions.some(s => s.active)
            const displayName = getGroupDisplayName(group.directory)

            return {
                key,
                directory: group.directory,
                displayName,
                machineId: group.machineId,
                sessions: sortedSessions,
                latestUpdatedAt,
                hasActiveSession
            }
        })
        .sort((a, b) => {
            if (a.hasActiveSession !== b.hasActiveSession) {
                return a.hasActiveSession ? -1 : 1
            }
            return b.latestUpdatedAt - a.latestUpdatedAt
        })
}

function PlusIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
    )
}

function ChevronIcon(props: { className?: string; collapsed?: boolean }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`${props.className ?? ''} transition-transform duration-200 ${props.collapsed ? '' : 'rotate-90'}`}
        >
            <polyline points="9 18 15 12 9 6" />
        </svg>
    )
}

function MachineIcon(props: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={props.className}
        >
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
    )
}

function getSessionTitle(session: SessionSummary): string {
    if (session.metadata?.name) {
        return session.metadata.name
    }
    if (session.metadata?.summary?.text) {
        return session.metadata.summary.text
    }
    if (session.metadata?.path) {
        const parts = session.metadata.path.split('/').filter(Boolean)
        return parts.length > 0 ? parts[parts.length - 1] : session.id.slice(0, 8)
    }
    return session.id.slice(0, 8)
}

function getTodoProgress(session: SessionSummary): { completed: number; total: number } | null {
    if (!session.todoProgress) return null
    if (session.todoProgress.completed === session.todoProgress.total) return null
    return session.todoProgress
}

function getAgentLabel(session: SessionSummary): string {
    const flavor = session.metadata?.flavor?.trim()
    if (flavor) return flavor
    return 'unknown'
}

function formatRelativeTime(value: number, t: (key: string, params?: Record<string, string | number>) => string): string | null {
    const ms = value < 1_000_000_000_000 ? value * 1000 : value
    if (!Number.isFinite(ms)) return null
    const delta = Date.now() - ms
    if (delta < 60_000) return t('session.time.justNow')
    const minutes = Math.floor(delta / 60_000)
    if (minutes < 60) return t('session.time.minutesAgo', { n: minutes })
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return t('session.time.hoursAgo', { n: hours })
    const days = Math.floor(hours / 24)
    if (days < 7) return t('session.time.daysAgo', { n: days })
    return new Date(ms).toLocaleDateString()
}

function SessionItem(props: {
    session: SessionSummary
    onSelect: (sessionId: string) => void
    showPath?: boolean
    api: ApiClient | null
    selected?: boolean
    isNew?: boolean
}) {
    const { t } = useTranslation()
    const { session: s, onSelect, showPath = true, api, selected = false, isNew = false } = props
    const { haptic } = usePlatform()
    const [menuOpen, setMenuOpen] = useState(false)
    const [menuAnchorPoint, setMenuAnchorPoint] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
    const [renameOpen, setRenameOpen] = useState(false)
    const [archiveOpen, setArchiveOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)

    const { archiveSession, renameSession, deleteSession, isPending } = useSessionActions(
        api,
        s.id,
        s.metadata?.flavor ?? null
    )

    const longPressHandlers = useLongPress({
        onLongPress: (point) => {
            haptic.impact('medium')
            setMenuAnchorPoint(point)
            setMenuOpen(true)
        },
        onClick: () => {
            if (!menuOpen) {
                onSelect(s.id)
            }
        },
        threshold: 500
    })

    const sessionName = getSessionTitle(s)
    const modelLabel = getSessionModelLabel(s)
    const todoProgress = getTodoProgress(s)
    const effortLabel = formatEffortLabel(s.effort)
    const flavor = s.metadata?.flavor?.trim() ?? null
    const agentLabel = getAgentLabel(s)
    const statusDotClass = s.active
        ? (s.thinking ? 'bg-[var(--app-badge-info-text)]' : 'bg-[var(--app-badge-success-text)]')
        : 'bg-[var(--app-hint)]'

    return (
        <>
            <button
                type="button"
                {...longPressHandlers}
                className={`session-list-item flex w-full flex-col gap-2 px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--app-link)] select-none ${selected ? 'bg-[var(--app-secondary-bg)]' : ''} ${isNew ? 'animate-session-enter' : ''}`}
                style={{ WebkitTouchCallout: 'none' }}
                aria-current={selected ? 'page' : undefined}
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2">
                        <span className="flex h-4 w-4 items-center justify-center" aria-hidden="true">
                            <span
                                className={`h-2 w-2 rounded-full transition-[background-color,box-shadow] duration-400 motion-reduce:duration-100 ${statusDotClass} ${s.thinking ? 'animate-glow-breathe' : ''}`}
                            />
                        </span>
                        <div className={`min-w-0 ${!s.active ? 'opacity-[0.55]' : ''}`}>
                            <div className="truncate text-base font-medium" title={sessionName}>
                                {sessionName}
                            </div>
                            {showPath ? (
                                <div className="mt-0.5 truncate text-xs text-[var(--app-hint)]" title={s.metadata?.path ?? s.id}>
                                    {s.metadata?.path ?? s.id}
                                </div>
                            ) : null}
                        </div>
                    </div>
                    <div className="shrink-0 pt-0.5 text-[11px] text-[var(--app-hint)]">
                        {formatRelativeTime(s.updatedAt, t)}
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-1 pl-6 text-xs">
                    <div className={`flex flex-wrap items-center gap-1 ${!s.active ? 'opacity-[0.55]' : ''}`}>
                        <span className={getFlavorTextClass(flavor)}>
                            {agentLabel}
                        </span>
                        {modelLabel ? (
                            <>
                                <span className={META_DOT_SEPARATOR_CLASS} aria-hidden="true">·</span>
                                <span className="text-[var(--app-fg)]" title={modelLabel.value}>
                                    {modelLabel.value}
                                </span>
                            </>
                        ) : null}
                        {effortLabel ? (
                            <>
                                <span className={META_DOT_SEPARATOR_CLASS} aria-hidden="true">·</span>
                                <span className="text-[var(--app-hint)]" title={effortLabel}>
                                    {effortLabel}
                                </span>
                            </>
                        ) : null}
                        {s.metadata?.worktree?.branch ? (
                            <>
                                <span className={META_DOT_SEPARATOR_CLASS} aria-hidden="true">·</span>
                                <span className="text-[var(--app-hint)]" title={s.metadata.worktree.branch}>
                                    {s.metadata.worktree.branch}
                                </span>
                            </>
                        ) : null}
                        {todoProgress ? (
                            <>
                                <span className={META_DOT_SEPARATOR_CLASS} aria-hidden="true">·</span>
                                <span className="text-[var(--app-hint)]">
                                    {todoProgress.completed}/{todoProgress.total}
                                </span>
                            </>
                        ) : null}
                    </div>
                    {s.thinking ? (
                        <span className={`${SESSION_ACTIVITY_BADGE} animate-badge-breathe`}>
                            {t('session.item.thinking')}
                        </span>
                    ) : null}
                    {s.pendingRequestsCount > 0 ? (
                        <span className={SESSION_PENDING_BADGE}>
                            {t('session.item.pending')} {s.pendingRequestsCount}
                        </span>
                    ) : null}
                </div>
            </button>

            <SessionActionMenu
                isOpen={menuOpen}
                onClose={() => setMenuOpen(false)}
                sessionActive={s.active}
                onRename={() => setRenameOpen(true)}
                onArchive={() => setArchiveOpen(true)}
                onDelete={() => setDeleteOpen(true)}
                anchorPoint={menuAnchorPoint}
            />

            <RenameSessionDialog
                isOpen={renameOpen}
                onClose={() => setRenameOpen(false)}
                currentName={sessionName}
                onRename={renameSession}
                isPending={isPending}
            />

            <ConfirmDialog
                isOpen={archiveOpen}
                onClose={() => setArchiveOpen(false)}
                title={t('dialog.archive.title')}
                description={t('dialog.archive.description', { name: sessionName })}
                confirmLabel={t('dialog.archive.confirm')}
                confirmingLabel={t('dialog.archive.confirming')}
                onConfirm={archiveSession}
                isPending={isPending}
                destructive
            />

            <ConfirmDialog
                isOpen={deleteOpen}
                onClose={() => setDeleteOpen(false)}
                title={t('dialog.delete.title')}
                description={t('dialog.delete.description', { name: sessionName })}
                confirmLabel={t('dialog.delete.confirm')}
                confirmingLabel={t('dialog.delete.confirming')}
                onConfirm={deleteSession}
                isPending={isPending}
                destructive
            />
        </>
    )
}

function GroupHeader(props: {
    group: SessionGroup
    isCollapsed: boolean
    machineLabel: string
    onToggle: () => void
}) {
    return (
        <button
            type="button"
            onClick={props.onToggle}
            className="sticky top-0 z-10 flex w-full flex-col gap-1 border-b border-[var(--app-divider)] bg-[var(--app-bg)] px-3 py-2 text-left transition-colors hover:bg-[var(--app-secondary-bg)]"
        >
            <div className="flex min-w-0 items-center gap-2">
                <ChevronIcon
                    className="h-4 w-4 shrink-0 text-[var(--app-hint)]"
                    collapsed={props.isCollapsed}
                />
                <span className="min-w-0 break-words font-medium text-base" title={props.group.directory}>
                    {props.group.displayName}
                </span>
                <span className="shrink-0 text-xs text-[var(--app-hint)]">
                    ({props.group.sessions.length})
                </span>
            </div>
            <div className="flex min-w-0 items-center gap-2 pl-6 text-xs text-[var(--app-hint)]">
                <span className="inline-flex items-center gap-1 rounded border border-[var(--app-border)] bg-[var(--app-subtle-bg)] px-1.5 py-0.5">
                    <MachineIcon className="h-3 w-3 shrink-0" />
                    <span className="truncate">{props.machineLabel}</span>
                </span>
                <span className="truncate" title={props.group.directory}>
                    {props.group.directory}
                </span>
            </div>
        </button>
    )
}

export function SessionList(props: {
    sessions: SessionSummary[]
    onSelect: (sessionId: string) => void
    onNewSession: () => void
    onRefresh: () => void
    isLoading: boolean
    renderHeader?: boolean
    api: ApiClient | null
    machineLabelsById?: Record<string, string>
    selectedSessionId?: string | null
}) {
    const { t } = useTranslation()
    const { renderHeader = true, api, machineLabelsById = {}, selectedSessionId } = props
    const groups = useMemo(
        () => groupSessionsByDirectory(props.sessions),
        [props.sessions]
    )
    const [collapseOverrides, setCollapseOverrides] = useState<Map<string, boolean>>(
        () => new Map()
    )
    const initialSessionIdsRef = useRef<Set<string> | null>(null)
    if (initialSessionIdsRef.current === null) {
        initialSessionIdsRef.current = new Set(props.sessions.map(s => s.id))
    }
    const resolveMachineLabel = (machineId: string | null): string => {
        if (machineId && machineLabelsById[machineId]) {
            return machineLabelsById[machineId]
        }
        if (machineId) {
            return machineId.slice(0, 8)
        }
        return t('machine.unknown')
    }
    const isGroupCollapsed = (group: SessionGroup): boolean => {
        const override = collapseOverrides.get(group.key)
        if (override !== undefined) return override
        return !group.hasActiveSession
    }

    const toggleGroup = (groupKey: string, isCollapsed: boolean) => {
        setCollapseOverrides(prev => {
            const next = new Map(prev)
            next.set(groupKey, !isCollapsed)
            return next
        })
    }

    useEffect(() => {
        setCollapseOverrides(prev => {
            if (prev.size === 0) return prev
            const next = new Map(prev)
            const knownGroups = new Set(groups.map(group => group.key))
            let changed = false
            for (const groupKey of next.keys()) {
                if (!knownGroups.has(groupKey)) {
                    next.delete(groupKey)
                    changed = true
                }
            }
            return changed ? next : prev
        })
    }, [groups])

    return (
        <div className="mx-auto w-full max-w-content flex flex-col">
            {renderHeader ? (
                <div className="flex items-center justify-between px-3 py-1">
                    <div className="text-xs text-[var(--app-hint)]">
                        {t('sessions.count', { n: props.sessions.length, m: groups.length })}
                    </div>
                    <button
                        type="button"
                        onClick={props.onNewSession}
                        className="session-list-new-button p-1.5 rounded-full text-[var(--app-link)] transition-colors"
                        title={t('sessions.new')}
                    >
                        <PlusIcon className="h-5 w-5" />
                    </button>
                </div>
            ) : null}

            <div className="flex flex-col">
                {groups.map((group) => {
                    const isCollapsed = isGroupCollapsed(group)
                    return (
                        <div key={group.key}>
                            <GroupHeader
                                group={group}
                                isCollapsed={isCollapsed}
                                machineLabel={resolveMachineLabel(group.machineId)}
                                onToggle={() => toggleGroup(group.key, isCollapsed)}
                            />
                            {!isCollapsed ? (
                                <div className="flex flex-col divide-y divide-[var(--app-divider)] border-b border-[var(--app-divider)]">
                                    {group.sessions.map((s) => (
                                        <SessionItem
                                            key={s.id}
                                            session={s}
                                            onSelect={props.onSelect}
                                            showPath={false}
                                            api={api}
                                            selected={s.id === selectedSessionId}
                                            isNew={!initialSessionIdsRef.current!.has(s.id)}
                                        />
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
