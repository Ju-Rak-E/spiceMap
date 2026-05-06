import { useToast, type ToastTone } from './ToastContext'

const TONE_STYLE: Record<ToastTone, { bg: string; border: string; icon: string; iconLabel: string }> = {
  success: { bg: 'rgba(46,125,50,0.95)', border: '#66BB6A', icon: 'OK', iconLabel: '성공' },
  error: { bg: 'rgba(183,28,28,0.95)', border: '#EF5350', icon: '!', iconLabel: '오류' },
  info: { bg: 'rgba(21,29,38,0.95)', border: '#42A5F5', icon: 'i', iconLabel: '안내' },
}

export default function ToastViewport() {
  const { toasts, dismiss } = useToast()

  if (toasts.length === 0) return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((toast) => {
        const tone = TONE_STYLE[toast.tone]
        return (
          <div
            key={toast.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              minWidth: 240,
              maxWidth: 480,
              background: tone.bg,
              border: `1px solid ${tone.border}`,
              borderRadius: 8,
              color: '#FFF',
              fontSize: 13,
              boxShadow: '0 8px 20px rgba(0,0,0,0.35)',
              backdropFilter: 'blur(6px)',
              pointerEvents: 'auto',
            }}
          >
            <span
              aria-label={tone.iconLabel}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 22,
                height: 22,
                borderRadius: '50%',
                background: tone.border,
                color: '#FFF',
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {tone.icon}
            </span>
            <span style={{ flex: 1, lineHeight: 1.4 }}>{toast.message}</span>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="알림 닫기"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#FFF',
                cursor: 'pointer',
                fontSize: 16,
                lineHeight: 1,
                padding: 4,
                opacity: 0.8,
              }}
            >
              x
            </button>
          </div>
        )
      })}
    </div>
  )
}
