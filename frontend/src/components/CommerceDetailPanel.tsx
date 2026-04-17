import type { CSSProperties } from 'react'
import type { CommerceNode } from '../types/commerce'
import { COMMERCE_COLORS, getInterventionBadge } from '../styles/tokens'
import { useGriHistory } from '../hooks/useGriHistory'

interface Props {
  node: CommerceNode | null
  onClose: () => void
}

const LEVEL_COLOR: Record<string, string> = {
  safe: '#43A047',
  warning: '#FB8C00',
  danger: '#E53935',
}

const GRI_MAX = 100
const CHART_W = 220
const CHART_H = 60
const CHART_PAD = { left: 8, right: 8, top: 8, bottom: 4 }

function GriSparkline({ scores }: { scores: { score: number; level: string }[] }) {
  if (scores.length < 2) return null

  const innerW = CHART_W - CHART_PAD.left - CHART_PAD.right
  const innerH = CHART_H - CHART_PAD.top - CHART_PAD.bottom
  const xStep = innerW / (scores.length - 1)

  const points = scores.map((p, i) => ({
    x: CHART_PAD.left + i * xStep,
    y: CHART_PAD.top + innerH * (1 - p.score / GRI_MAX),
    ...p,
  }))

  const polyline = points.map(p => `${p.x},${p.y}`).join(' ')

  return (
    <svg width={CHART_W} height={CHART_H} style={{ display: 'block' }}>
      {/* 70 경보선 */}
      <line
        x1={CHART_PAD.left}
        x2={CHART_W - CHART_PAD.right}
        y1={CHART_PAD.top + innerH * (1 - 70 / GRI_MAX)}
        y2={CHART_PAD.top + innerH * (1 - 70 / GRI_MAX)}
        stroke="#FB8C00"
        strokeWidth={0.8}
        strokeDasharray="3 2"
        opacity={0.6}
      />
      <polyline
        points={polyline}
        fill="none"
        stroke="#90CAF9"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={3}
          fill={LEVEL_COLOR[p.level] ?? '#90CAF9'}
        />
      ))}
    </svg>
  )
}

const S: Record<string, CSSProperties> = {
  panel: {
    position: 'absolute',
    top: 60,
    right: 336,
    width: 272,
    background: '#10161D',
    borderRadius: 10,
    border: '1px solid #24323F',
    padding: '14px 16px',
    color: '#E7EEF5',
    fontFamily: 'inherit',
    zIndex: 10,
    boxShadow: '0 4px 20px rgba(0,0,0,0.45)',
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  name: { fontSize: 14, fontWeight: 700, color: '#E7EEF5', lineHeight: 1.3 },
  closeBtn: {
    background: 'none', border: 'none', color: '#6E8093', cursor: 'pointer',
    fontSize: 16, lineHeight: 1, padding: 2,
  },
  typeBadge: { display: 'inline-block', fontSize: 11, borderRadius: 4, padding: '2px 7px', marginBottom: 10 },
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  label: { fontSize: 11, color: '#A6B4C2' },
  value: { fontSize: 13, fontWeight: 600, color: '#E7EEF5' },
  griScore: { fontSize: 24, fontWeight: 800 },
  divider: { border: 'none', borderTop: '1px solid #24323F', margin: '10px 0' },
  sectionTitle: { fontSize: 11, color: '#6E8093', marginBottom: 6 },
}

export default function CommerceDetailPanel({ node, onClose }: Props) {
  const { history } = useGriHistory(node?.id ?? null)

  if (!node) return null

  const typeToken = COMMERCE_COLORS[node.type]
  const badge = getInterventionBadge(node.griScore)

  return (
    <div style={S.panel}>
      <div style={S.header}>
        <span style={S.name}>{node.name}</span>
        <button style={S.closeBtn} onClick={onClose} aria-label="닫기">✕</button>
      </div>

      <span
        style={{
          ...S.typeBadge,
          background: typeToken.badgeColor,
          color: typeToken.textColor,
        }}
      >
        {typeToken.symbol} {typeToken.label}
      </span>

      <div style={S.row}>
        <span style={S.label}>GRI 위험지수</span>
        <span style={{ ...S.griScore, color: LEVEL_COLOR[node.griScore >= 85 ? 'danger' : node.griScore >= 70 ? 'warning' : 'safe'] }}>
          {node.griScore}
        </span>
      </div>

      {badge && (
        <div style={S.row}>
          <span style={S.label}>개입 등급</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: badge.color, background: badge.bg, borderRadius: 4, padding: '2px 8px' }}>
            {badge.label}
          </span>
        </div>
      )}

      <div style={S.row}>
        <span style={S.label}>순유입</span>
        <span style={S.value}>{node.netFlow.toLocaleString()}</span>
      </div>

      <div style={S.row}>
        <span style={S.label}>연결 중심성</span>
        <span style={S.value}>{(node.degreeCentrality * 100).toFixed(0)}%</span>
      </div>

      {history.length > 0 && (
        <>
          <hr style={S.divider} />
          <div style={S.sectionTitle}>GRI 추세 (분기별)</div>
          <GriSparkline scores={history} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 10, color: '#607D8B' }}>{history[0]?.quarter}</span>
            <span style={{ fontSize: 10, color: '#607D8B' }}>{history[history.length - 1]?.quarter}</span>
          </div>
        </>
      )}
    </div>
  )
}
