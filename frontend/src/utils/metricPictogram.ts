import type { HeightMetric } from '../hooks/use3DView'
import type { CommerceNode } from '../types/commerce'
import { getMetricValue } from './threeDUtils'

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
    count: Math.max(1, Math.min(3, Math.round(1 + intensity * 2))),
    size: Math.round(10 + intensity * 12),
  }
}
