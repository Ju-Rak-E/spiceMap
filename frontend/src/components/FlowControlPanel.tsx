import type { FlowPurpose, FlowStats } from '../hooks/useFlowData'

interface FlowControlPanelProps {
  purpose: FlowPurpose | null
  onPurposeChange: (p: FlowPurpose | null) => void
  hour: number
  onHourChange: (h: number) => void
  flowStrength: number
  onStrengthChange: (s: number) => void
  boundaryOpacity: number
  onBoundaryOpacityChange: (v: number) => void
  stats: FlowStats
}

const PURPOSES: FlowPurpose[] = ['출근', '쇼핑', '관광', '귀가', '등교']

const AI_INSIGHT: Record<FlowPurpose, { title: string; desc: string }> = {
  출근: { title: '강남구 역삼', desc: '평일 오전 출근 흐름의 핵심 목적지' },
  쇼핑: { title: '강남구 압구정', desc: '20~30대 쇼핑 흐름의 핵심 목적' },
  관광: { title: '강남구 청담', desc: '주말 관광 흐름이 집중되는 상권' },
  귀가: { title: '관악구 신림', desc: '저녁 귀가 흐름의 주요 도착지' },
  등교: { title: '관악구 낙성대', desc: '오전 7~9시 학교 인근 집중 흐름' },
}

function formatVolume(v: number): string {
  if (v >= 10000) return `${(v / 10000).toFixed(0)}만`
  return v.toLocaleString()
}

function formatLocation(id: string | null): string {
  if (!id) return '-'
  const parts = id.split('_')
  return parts[parts.length - 1] ?? id
}

const S = {
  panel: {
    width: 280,
    minWidth: 280,
    height: '100%',
    background: '#1A2332',
    borderLeft: '1px solid #263238',
    display: 'flex' as const,
    flexDirection: 'column' as const,
    overflowY: 'auto' as const,
    padding: '16px 14px',
    gap: 16,
    boxSizing: 'border-box' as const,
    color: '#ECEFF1',
    fontFamily: 'system-ui, sans-serif',
  },
  header: {
    paddingBottom: 12,
    borderBottom: '1px solid #263238',
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#ECEFF1',
    display: 'flex' as const,
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  headerSub: { fontSize: 11, color: '#546E7A' },
  section: { display: 'flex' as const, flexDirection: 'column' as const, gap: 8 },
  label: { fontSize: 12, color: '#90A4AE', fontWeight: 600 },
  purposeGrid: {
    display: 'grid' as const,
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: 6,
  },
  purposeBtn: (active: boolean): React.CSSProperties => ({
    padding: '8px 4px',
    borderRadius: 8,
    border: active ? '1.5px solid #43A047' : '1px solid #37474F',
    background: active ? '#1B5E20' : '#263238',
    color: active ? '#A5D6A7' : '#90A4AE',
    fontSize: 13,
    fontWeight: active ? 700 : 400,
    cursor: 'pointer',
    transition: 'all 0.15s',
    textAlign: 'center' as const,
  }),
  sliderRow: {
    display: 'flex' as const,
    alignItems: 'center',
    gap: 8,
  },
  slider: {
    flex: 1,
    accentColor: '#43A047',
    cursor: 'pointer',
  },
  sliderValue: {
    fontSize: 13,
    color: '#ECEFF1',
    fontWeight: 600,
    minWidth: 36,
    textAlign: 'right' as const,
  },
  statsGrid: {
    display: 'grid' as const,
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  },
  statCard: {
    background: '#263238',
    borderRadius: 8,
    padding: '10px 12px',
  },
  statLabel: { fontSize: 11, color: '#546E7A', marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: 700, color: '#ECEFF1' },
  insightCard: {
    background: '#263238',
    borderRadius: 8,
    padding: '12px',
    borderLeft: '3px solid #F9A825',
  },
  insightHeader: {
    fontSize: 11,
    color: '#F9A825',
    fontWeight: 700,
    marginBottom: 6,
    display: 'flex' as const,
    alignItems: 'center',
    gap: 4,
  },
  insightTitle: { fontSize: 15, fontWeight: 700, color: '#ECEFF1', marginBottom: 3 },
  insightDesc: { fontSize: 12, color: '#90A4AE' },
}

export default function FlowControlPanel({
  purpose,
  onPurposeChange,
  hour,
  onHourChange,
  flowStrength,
  onStrengthChange,
  boundaryOpacity,
  onBoundaryOpacityChange,
  stats,
}: FlowControlPanelProps) {
  const insight = purpose ? AI_INSIGHT[purpose] : null

  return (
    <div style={S.panel}>
      {/* 헤더 */}
      <div style={S.header}>
        <div style={S.headerTitle}>
          <span>🎮</span>
          <span>스파이스 흐름 제어판</span>
        </div>
        <div style={S.headerSub}>둔 세계관 × 서울 빅데이터</div>
      </div>

      {/* 이동 목적 */}
      <div style={S.section}>
        <div style={S.label}>이동 목적 (스파이스 종류)</div>
        <div style={S.purposeGrid}>
          {PURPOSES.map((p) => (
            <button
              key={p}
              style={S.purposeBtn(purpose === p)}
              onClick={() => onPurposeChange(purpose === p ? null : p)}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* 시간대 슬라이더 */}
      <div style={S.section}>
        <div style={S.label}>시간대</div>
        <div style={S.sliderRow}>
          <input
            type="range"
            min={0}
            max={23}
            value={hour}
            onChange={(e) => onHourChange(Number(e.target.value))}
            style={S.slider}
          />
          <span style={S.sliderValue}>{hour}시</span>
        </div>
      </div>

      {/* 흐름 강도 슬라이더 */}
      <div style={S.section}>
        <div style={S.label}>흐름 강도</div>
        <div style={S.sliderRow}>
          <input
            type="range"
            min={1}
            max={5}
            value={flowStrength}
            onChange={(e) => onStrengthChange(Number(e.target.value))}
            style={S.slider}
          />
          <span style={S.sliderValue}>{flowStrength}단계</span>
        </div>
      </div>

      {/* 상권 영역 투명도 슬라이더 */}
      <div style={S.section}>
        <div style={S.label}>상권 영역 투명도</div>
        <div style={S.sliderRow}>
          <input
            type="range"
            min={0}
            max={80}
            step={5}
            value={Math.round(boundaryOpacity * 100)}
            onChange={(e) => onBoundaryOpacityChange(Number(e.target.value) / 100)}
            style={S.slider}
          />
          <span style={S.sliderValue}>{Math.round(boundaryOpacity * 100)}%</span>
        </div>
      </div>

      {/* 통계 */}
      <div style={S.statsGrid}>
        <div style={S.statCard}>
          <div style={S.statLabel}>총 이동량</div>
          <div style={S.statValue}>{formatVolume(stats.totalVolume)}</div>
        </div>
        <div style={S.statCard}>
          <div style={S.statLabel}>활성 흐름</div>
          <div style={S.statValue}>{stats.activeCount}</div>
        </div>
        <div style={S.statCard}>
          <div style={S.statLabel}>최대 유입</div>
          <div style={{ ...S.statValue, fontSize: 14, color: '#43A047' }}>
            {formatLocation(stats.topInflow)}
          </div>
        </div>
        <div style={S.statCard}>
          <div style={S.statLabel}>최대 유출</div>
          <div style={{ ...S.statValue, fontSize: 14, color: '#EF5350' }}>
            {formatLocation(stats.topOutflow)}
          </div>
        </div>
      </div>

      {/* AI 인사이트 */}
      {insight && (
        <div style={S.insightCard}>
          <div style={S.insightHeader}>
            <span>⚡</span>
            <span>AI 인사이트</span>
          </div>
          <div style={S.insightTitle}>{insight.title}</div>
          <div style={S.insightDesc}>{insight.desc}</div>
        </div>
      )}
    </div>
  )
}
