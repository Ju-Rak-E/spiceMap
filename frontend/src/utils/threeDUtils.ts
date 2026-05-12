import type { CommerceNode } from '../types/commerce'

export type HeightMetric = 'griScore' | 'netFlow' | 'closeRate' | 'degreeCentrality'

export function normalizeElevation(
  value: number,
  min: number,
  max: number,
  maxHeight: number,
): number {
  if (max === min) return maxHeight * 0.5
  return Math.max(0, ((value - min) / (max - min)) * maxHeight)
}

export function getMetricValue(node: CommerceNode, metric: HeightMetric): number {
  switch (metric) {
    case 'griScore': return node.griScore
    case 'netFlow': return node.netFlow
    case 'closeRate': return node.closeRate ?? 0
    case 'degreeCentrality': return node.degreeCentrality
  }
}

export function easeOutCubic(t: number): number {
  const clamped = Math.max(0, Math.min(1, t))
  return 1 - Math.pow(1 - clamped, 3)
}

export function interpolateProgress(
  start: number,
  target: number,
  elapsedMs: number,
  durationMs: number,
): number {
  if (durationMs <= 0) return target
  const t = Math.min(1, elapsedMs / durationMs)
  return start + (target - start) * easeOutCubic(t)
}

const METRIC_LABEL: Record<HeightMetric, string> = {
  griScore: '상권 위험도',
  netFlow: '순유입 인구',
  closeRate: '폐업률',
  degreeCentrality: '연결 중심성',
}

export function getMetricLabel(metric: HeightMetric): string {
  return METRIC_LABEL[metric]
}

export function formatMetricValue(value: number, metric: HeightMetric): string {
  switch (metric) {
    case 'griScore':
      return `${value.toFixed(1)}점`
    case 'netFlow': {
      const sign = value >= 0 ? '+' : ''
      return `${sign}${value.toLocaleString()}명`
    }
    case 'closeRate':
      return `${value.toFixed(1)}%`
    case 'degreeCentrality':
      return value.toFixed(3)
  }
}
