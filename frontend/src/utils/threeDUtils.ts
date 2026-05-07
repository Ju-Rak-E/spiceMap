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
