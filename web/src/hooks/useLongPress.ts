import type React from 'react'
import { useCallback, useRef } from 'react'

type UseLongPressOptions = {
    onLongPress: (point: { x: number; y: number }) => void
    onClick?: () => void
    threshold?: number
    disabled?: boolean
}

type UseLongPressHandlers = {
    onPointerDown: React.PointerEventHandler
    onPointerMove: React.PointerEventHandler
    onPointerUp: React.PointerEventHandler
    onPointerLeave: React.PointerEventHandler
    onPointerCancel: React.PointerEventHandler
    onContextMenu: React.MouseEventHandler
    onKeyDown: React.KeyboardEventHandler
}

export function useLongPress(options: UseLongPressOptions): UseLongPressHandlers {
    const { onLongPress, onClick, threshold = 500, disabled = false } = options

    const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const isLongPressRef = useRef(false)
    const pressPointRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
    const movedBeyondThresholdRef = useRef(false)
    const moveThresholdPx = 8

    const clearTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current)
            timerRef.current = null
        }
    }, [])

    const startTimer = useCallback((clientX: number, clientY: number) => {
        if (disabled) return

        clearTimer()
        isLongPressRef.current = false
        movedBeyondThresholdRef.current = false
        pressPointRef.current = { x: clientX, y: clientY }

        timerRef.current = setTimeout(() => {
            isLongPressRef.current = true
            onLongPress(pressPointRef.current)
        }, threshold)
    }, [disabled, clearTimer, onLongPress, threshold])

    const handleEnd = useCallback((shouldTriggerClick: boolean) => {
        clearTimer()

        if (shouldTriggerClick && !isLongPressRef.current && onClick) {
            onClick()
        }

        isLongPressRef.current = false
        movedBeyondThresholdRef.current = false
    }, [clearTimer, onClick])

    const onPointerDown = useCallback<React.PointerEventHandler>((e) => {
        if (!e.isPrimary) return
        if (e.pointerType === 'mouse' && e.button !== 0) return
        startTimer(e.clientX, e.clientY)
    }, [startTimer])

    const onPointerMove = useCallback<React.PointerEventHandler>((e) => {
        if (!e.isPrimary || movedBeyondThresholdRef.current) return

        const dx = e.clientX - pressPointRef.current.x
        const dy = e.clientY - pressPointRef.current.y
        if (Math.hypot(dx, dy) < moveThresholdPx) {
            return
        }

        movedBeyondThresholdRef.current = true
        clearTimer()
    }, [clearTimer])

    const onPointerUp = useCallback<React.PointerEventHandler>((e) => {
        if (!e.isPrimary) return
        handleEnd(!isLongPressRef.current && !movedBeyondThresholdRef.current)
    }, [handleEnd])

    const onPointerLeave = useCallback<React.PointerEventHandler>((e) => {
        if (!e.isPrimary) return
        handleEnd(false)
    }, [handleEnd])

    const onPointerCancel = useCallback<React.PointerEventHandler>((e) => {
        if (!e.isPrimary) return
        handleEnd(false)
    }, [handleEnd])

    const onContextMenu = useCallback<React.MouseEventHandler>((e) => {
        if (!disabled) {
            e.preventDefault()
            clearTimer()
            isLongPressRef.current = true
            onLongPress({ x: e.clientX, y: e.clientY })
        }
    }, [disabled, clearTimer, onLongPress])

    const onKeyDown = useCallback<React.KeyboardEventHandler>((e) => {
        if (disabled) return
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick?.()
        }
    }, [disabled, onClick])

    return {
        onPointerDown,
        onPointerMove,
        onPointerUp,
        onPointerLeave,
        onPointerCancel,
        onContextMenu,
        onKeyDown
    }
}
