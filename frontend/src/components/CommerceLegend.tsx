import { useEffect, useMemo, useRef, useState } from 'react'
import { COMMERCE_COLORS } from '../styles/tokens'
import type { CommerceType } from '../styles/tokens'

interface CommerceLegendProps {
  theme?: 'dark' | 'light'
  bottom?: number
  selectedTypes: Set<CommerceType>
  onToggle: (type: CommerceType) => void
}

function getSummaryLabel(selectedTypes: Set<CommerceType>) {
  const total = Object.keys(COMMERCE_COLORS).length
  if (selectedTypes.size === total) return '전체 유형'
  if (selectedTypes.size === 0) return '유형 미선택'
  if (selectedTypes.size === 1) {
    const selected = [...selectedTypes][0]
    return COMMERCE_COLORS[selected].label
  }
  return `${selectedTypes.size}개 유형 선택`
}

export default function CommerceLegend({
  theme = 'dark',
  bottom = 40,
  selectedTypes,
  onToggle,
}: CommerceLegendProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const isDark = theme === 'dark'
  const bg = isDark ? 'rgba(16,22,29,0.96)' : 'rgba(255,255,255,0.96)'
  const panelBg = isDark ? 'rgba(21,29,38,0.98)' : 'rgba(247,249,251,0.98)'
  const text = isDark ? '#ECEFF1' : '#212121'
  const border = isDark ? '#24323F' : '#D5DDE5'
  const dimText = isDark ? '#6E8093' : '#708090'
  const buttonBg = isDark ? '#151D26' : '#FFFFFF'
  const summaryLabel = useMemo(() => getSummaryLabel(selectedTypes), [selectedTypes])
  const allSelected = selectedTypes.size === Object.keys(COMMERCE_COLORS).length

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [open])

  return (
    <div
      ref={containerRef}
      style={{
        position: 'absolute',
        bottom,
        right: 16,
        zIndex: 7,
        userSelect: 'none',
      }}
    >
      {open && (
        <div
          style={{
            position: 'absolute',
            bottom: 52,
            right: 0,
            width: 232,
            background: panelBg,
            border: `1px solid ${border}`,
            borderRadius: 10,
            padding: '12px 14px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontWeight: 700, fontSize: 11, letterSpacing: '0.04em', color: text }}>
              상권 유형 선택
            </span>
            <button
              onClick={() => {
                const types = Object.keys(COMMERCE_COLORS) as CommerceType[]
                if (allSelected) {
                  types.forEach(type => onToggle(type))
                } else {
                  types.filter(type => !selectedTypes.has(type)).forEach(type => onToggle(type))
                }
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: 10,
                color: dimText,
                padding: 0,
              }}
            >
              {allSelected ? '전체 해제' : '전체 선택'}
            </button>
          </div>

          {(Object.entries(COMMERCE_COLORS) as [CommerceType, typeof COMMERCE_COLORS[CommerceType]][]).map(
            ([key, token]) => {
              const active = selectedTypes.has(key)
              return (
                <button
                  key={key}
                  onClick={() => onToggle(key)}
                  aria-pressed={active}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                    marginBottom: 6,
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px 0',
                    borderRadius: 4,
                    opacity: active ? 1 : 0.38,
                    transition: 'opacity 0.15s',
                    color: text,
                    fontSize: 12,
                    textAlign: 'left',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: active ? token.fill : (isDark ? '#37474F' : '#BDBDBD'),
                      color: '#fff',
                      fontSize: 11,
                      fontWeight: 700,
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                    aria-hidden="true"
                  >
                    {token.symbol}
                  </span>
                  <div>
                    <div style={{ fontWeight: 600, lineHeight: 1.3 }}>{token.label}</div>
                    <div style={{ fontSize: 10, color: dimText, lineHeight: 1.4, marginTop: 1 }}>
                      {token.description}
                    </div>
                  </div>
                </button>
              )
            },
          )}
        </div>
      )}

      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(prev => !prev)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minWidth: 164,
          padding: '10px 12px',
          background: open ? bg : buttonBg,
          border: `1px solid ${border}`,
          borderRadius: 999,
          color: text,
          fontSize: 12,
          fontWeight: 600,
          boxShadow: '0 8px 20px rgba(0,0,0,0.25)',
          cursor: 'pointer',
          backdropFilter: 'blur(10px)',
        }}
      >
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: isDark ? '#17212B' : '#EEF3F8',
            color: text,
            fontSize: 11,
            flexShrink: 0,
          }}
        >
          ▴
        </span>
        <span style={{ flex: 1, textAlign: 'left' }}>{summaryLabel}</span>
      </button>
    </div>
  )
}
