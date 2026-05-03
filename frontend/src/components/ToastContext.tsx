/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'

export type ToastTone = 'success' | 'error' | 'info'

export interface ToastItem {
  id: number
  tone: ToastTone
  message: string
}

interface ToastContextValue {
  toasts: ToastItem[]
  show: (tone: ToastTone, message: string, durationMs?: number) => void
  success: (message: string, durationMs?: number) => void
  error: (message: string, durationMs?: number) => void
  info: (message: string, durationMs?: number) => void
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DEFAULT_DURATION_MS = 4000

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const seqRef = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const show = useCallback((tone: ToastTone, message: string, durationMs = DEFAULT_DURATION_MS) => {
    seqRef.current += 1
    const id = seqRef.current
    setToasts((prev) => [...prev, { id, tone, message }])
    if (durationMs > 0) {
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, durationMs)
    }
  }, [])

  const value = useMemo<ToastContextValue>(() => ({
    toasts,
    show,
    success: (message, durationMs) => show('success', message, durationMs),
    error: (message, durationMs) => show('error', message, durationMs),
    info: (message, durationMs) => show('info', message, durationMs),
    dismiss,
  }), [toasts, show, dismiss])

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast는 ToastProvider 하위에서만 사용 가능합니다')
  return ctx
}
