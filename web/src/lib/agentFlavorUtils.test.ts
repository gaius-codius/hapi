import { describe, expect, it } from 'vitest'
import { getFlavorTextClass, formatEffortLabel, META_DOT_SEPARATOR_CLASS } from './agentFlavorUtils'

describe('getFlavorTextClass', () => {
    it('returns claude text class for "claude"', () => {
        expect(getFlavorTextClass('claude')).toContain('--app-flavor-claude')
    })

    it('returns codex text class for "codex"', () => {
        expect(getFlavorTextClass('codex')).toContain('--app-flavor-codex')
    })

    it('returns hint class for unknown flavor', () => {
        expect(getFlavorTextClass('unknown-agent')).toContain('--app-hint')
    })

    it('returns hint class for null', () => {
        expect(getFlavorTextClass(null)).toContain('--app-hint')
    })

    it('trims and lowercases input', () => {
        expect(getFlavorTextClass('  Claude  ')).toContain('--app-flavor-claude')
    })

    it('returns gemini text class for "gemini"', () => {
        expect(getFlavorTextClass('gemini')).toContain('--app-flavor-gemini-text')
    })

    it('returns opencode text class for "opencode"', () => {
        expect(getFlavorTextClass('opencode')).toContain('--app-flavor-opencode-text')
    })

    it('returns cursor text class for "cursor"', () => {
        expect(getFlavorTextClass('cursor')).toContain('--app-flavor-cursor-text')
    })
})

describe('formatEffortLabel', () => {
    it('returns null for null/undefined/empty', () => {
        expect(formatEffortLabel(null)).toBeNull()
        expect(formatEffortLabel(undefined)).toBeNull()
        expect(formatEffortLabel('')).toBeNull()
        expect(formatEffortLabel('  ')).toBeNull()
    })

    it('capitalizes words', () => {
        expect(formatEffortLabel('high-effort')).toBe('High Effort')
    })
})

describe('META_DOT_SEPARATOR_CLASS', () => {
    it('includes opacity', () => {
        expect(META_DOT_SEPARATOR_CLASS).toContain('opacity')
    })
})
