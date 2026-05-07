import type { ThreeDMode, HeightMetric } from '../hooks/use3DView'
import type { CommerceNode } from '../types/commerce'
import { getMetricValue } from '../utils/threeDUtils'

const METRIC_OPTIONS: Array<{ value: HeightMetric; label: string; icon: string; accent: string }> = [
  { value: 'griScore', label: '상권 위험도', icon: '!', accent: '#EF5350' },
  { value: 'netFlow', label: '순유입 인구', icon: '사람', accent: '#42A5F5' },
  { value: 'closeRate', label: '폐업률', icon: '닫힘', accent: '#FFB74D' },
  { value: 'degreeCentrality', label: '연결 중심성', icon: '연결', accent: '#7BD08D' },
]

const MODE_LABELS: Record<ThreeDMode, string> = {
  off: 'OFF',
  polygon: '폴리곤',
  column: '이미지',
}

interface ThreeDViewControlProps {
  mode: ThreeDMode
  metric: HeightMetric
  nodes?: CommerceNode[]
  onModeChange: (m: ThreeDMode) => void
  onMetricChange: (m: HeightMetric) => void
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function getMetricIntensity(nodes: CommerceNode[] | undefined, metric: HeightMetric): number {
  if (!nodes || nodes.length === 0) return 0.35
  const values = nodes.map((node) => getMetricValue(node, metric)).filter(Number.isFinite)
  if (values.length === 0) return 0.35
  const max = Math.max(...values)
  switch (metric) {
    case 'griScore':
      return clamp01(max / 100)
    case 'netFlow':
      return clamp01(Math.max(0, max) / 2000)
    case 'closeRate':
      return clamp01(max / 20)
    case 'degreeCentrality':
      return clamp01(max)
  }
}

export function getMetricPictogramStats(
  nodes: CommerceNode[] | undefined,
  metric: HeightMetric,
): { count: number; size: number } {
  const intensity = getMetricIntensity(nodes, metric)
  return {
    count: Math.max(1, Math.round(1 + intensity * 4)),
    size: Math.round(10 + intensity * 12),
  }
}

export default function ThreeDViewControl({
  mode,
  metric,
  nodes,
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
        {(['off', 'polygon', 'column'] as ThreeDMode[]).map((m) => (
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
              const stats = getMetricPictogramStats(nodes, opt.value)
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onMetricChange(opt.value)}
                  aria-pressed={selected}
                  data-testid={`metric-pictogram-${opt.value}`}
                  style={{
                    minHeight: 72,
                    border: `1px solid ${selected ? opt.accent : '#304251'}`,
                    borderRadius: 8,
                    background: selected ? `${opt.accent}1f` : '#121B24',
                    color: '#ECEFF1',
                    padding: '7px 6px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    boxSizing: 'border-box',
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, color: selected ? opt.accent : '#90A4AE', marginBottom: 5 }}>
                    {opt.label}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, minHeight: 30 }}>
                    {Array.from({ length: stats.count }).map((_, idx) => (
                      <span
                        key={idx}
                        aria-hidden="true"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: stats.size,
                          height: stats.size,
                          borderRadius: opt.value === 'degreeCentrality' ? '50%' : 4,
                          background: opt.accent,
                          color: '#0E141B',
                          fontSize: Math.max(7, Math.round(stats.size * 0.38)),
                          fontWeight: 800,
                          lineHeight: 1,
                          opacity: 0.72 + idx * 0.05,
                        }}
                      >
                        {opt.icon}
                      </span>
                    ))}
                  </div>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
