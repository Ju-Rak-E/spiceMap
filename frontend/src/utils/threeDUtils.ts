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
