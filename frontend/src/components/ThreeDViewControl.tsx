import type { ThreeDMode, HeightMetric } from '../hooks/use3DView'
import type { CommerceNode } from '../types/commerce'

const METRIC_OPTIONS: Array<{ value: HeightMetric; label: string; accent: string }> = [
  { value: 'griScore', label: '상권위험도', accent: '#EF5350' },
  { value: 'netFlow', label: '순유입인구', accent: '#42A5F5' },
  { value: 'closeRate', label: '폐업률', accent: '#FFB74D' },
  { value: 'degreeCentrality', label: '연결중심성', accent: '#7BD08D' },
]

const MODE_LABELS: Record<ThreeDMode, string> = {
  off: 'OFF',
  commerce: '상권 3D',
}

interface ThreeDViewControlProps {
  mode: ThreeDMode
  metric: HeightMetric
  nodes?: CommerceNode[]
  onModeChange: (m: ThreeDMode) => void
  onMetricChange: (m: HeightMetric) => void
}

export default function ThreeDViewControl({
  mode,
  metric,
  onModeChange,
  onMetricChange,
}: ThreeDViewControlProps) {
  const isActive = mode !== 'off'

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 24,
        right: 24,
        zIndex: 15,
        background: 'rgba(16,22,29,0.95)',
        border: `1px solid ${isActive ? '#43A047' : '#304251'}`,
        borderRadius: 10,
        padding: '10px 12px',
        minWidth: 196,
        boxShadow: isActive ? '0 0 12px rgba(67,160,71,0.2)' : 'none',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: isActive ? '#7BD08D' : '#78909C',
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        3D 뷰{isActive ? ' - 활성' : ''}
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: isActive ? 8 : 0 }}>
        {(['off', 'commerce'] as ThreeDMode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onModeChange(m)}
            aria-pressed={mode === m}
            style={{
              flex: 1,
              padding: '5px 0',
              borderRadius: 6,
              border: mode === m
                ? `1.5px solid ${m === 'off' ? '#546E7A' : '#43A047'}`
                : '1px solid #304251',
              background: mode === m
                ? m === 'off' ? '#263238' : 'rgba(67,160,71,0.2)'
                : '#1A2530',
              color: mode === m
                ? m === 'off' ? '#90A4AE' : '#7BD08D'
                : '#546E7A',
              fontSize: 11,
              fontWeight: mode === m ? 700 : 500,
              cursor: 'pointer',
            }}
          >
            {MODE_LABELS[m]}
          </button>
        ))}
      </div>
      {isActive && (
        <>
          <select
            value={metric}
            onChange={(e) => onMetricChange(e.target.value as HeightMetric)}
            aria-label="높이 기준 지표 선택"
            style={{
              width: '100%',
              background: '#1A2530',
              border: '1px solid #304251',
              borderRadius: 6,
              padding: '5px 8px',
              fontSize: 11,
              color: '#ECEFF1',
              cursor: 'pointer',
              boxSizing: 'border-box',
              marginBottom: 8,
            }}
          >
            {METRIC_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {METRIC_OPTIONS.map((opt) => {
              const selected = metric === opt.value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onMetricChange(opt.value)}
                  aria-pressed={selected}
                  data-testid={`metric-option-${opt.value}`}
                  style={{
                    minHeight: 42,
                    border: `1px solid ${selected ? opt.accent : '#304251'}`,
                    borderRadius: 8,
                    background: selected ? `${opt.accent}1f` : '#121B24',
                    color: selected ? opt.accent : '#90A4AE',
                    padding: '8px 10px',
                    cursor: 'pointer',
                    textAlign: 'center',
                    boxSizing: 'border-box',
                    fontSize: 12,
                    fontWeight: selected ? 800 : 700,
                  }}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
