import { useEffect, useState, type CSSProperties } from 'react'
import { MAP_THEME } from '../styles/tokens'

const COLORS = MAP_THEME.dark
const STORAGE_KEY = 'spicemap_mvp_notice_dismissed_v1'

const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(8,12,18,0.72)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1100,
    padding: 20,
  } satisfies CSSProperties,
  dialog: {
    background: COLORS.panelBg,
    border: `1px solid ${COLORS.panelBorder}`,
    borderRadius: 14,
    padding: '24px 26px',
    maxWidth: 420,
    width: '100%',
    boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
    color: COLORS.panelText,
    fontFamily: 'system-ui, sans-serif',
  } satisfies CSSProperties,
  badge: {
    display: 'inline-block',
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: '0.08em',
    color: '#f97316',
    background: 'rgba(249,115,22,0.12)',
    border: '1px solid rgba(249,115,22,0.35)',
    borderRadius: 999,
    padding: '3px 9px',
    textTransform: 'uppercase',
  } satisfies CSSProperties,
  title: {
    marginTop: 12,
    fontSize: 18,
    fontWeight: 800,
    color: COLORS.panelText,
    lineHeight: 1.4,
  } satisfies CSSProperties,
  body: {
    marginTop: 10,
    fontSize: 13,
    color: COLORS.secondaryText,
    lineHeight: 1.65,
  } satisfies CSSProperties,
  highlight: {
    color: '#BBDEFB',
    fontWeight: 750,
  } satisfies CSSProperties,
  actions: {
    marginTop: 20,
    display: 'flex',
    justifyContent: 'flex-end',
  } satisfies CSSProperties,
  confirmButton: {
    background: '#f97316',
    border: 'none',
    borderRadius: 8,
    padding: '9px 22px',
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
  } satisfies CSSProperties,
}

export default function MVPNoticeModal() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const dismissed = window.localStorage.getItem(STORAGE_KEY)
      if (!dismissed) setOpen(true)
    } catch {
      setOpen(true)
    }
  }, [])

  if (!open) return null

  const handleClose = () => {
    setOpen(false)
    try {
      window.localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // localStorage 사용 불가 환경: 세션 내에서만 닫힘 처리
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="mvp-notice-title"
      style={S.overlay}
      onClick={handleClose}
    >
      <div style={S.dialog} onClick={(event) => event.stopPropagation()}>
        <span style={S.badge}>MVP 안내</span>
        <div id="mvp-notice-title" style={S.title}>
          현재는 <span style={S.highlight}>강남구·관악구</span>만 전체 기능을 제공합니다
        </div>
        <p style={S.body}>
          MVP 단계에서는 두 자치구에 한해 업종 분석·추천 상권·흐름 단절을 모두 보여드립니다.
          추후 서울 전체 자치구 데이터로 확장할 예정입니다.
        </p>
        <div style={S.actions}>
          <button type="button" style={S.confirmButton} onClick={handleClose} autoFocus>
            확인
          </button>
        </div>
      </div>
    </div>
  )
}
