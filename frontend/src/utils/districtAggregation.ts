import type { CommerceNode } from '../types/commerce'
import { getMetricValue, type HeightMetric } from './threeDUtils'

export function aggregateMetricByDistrict(
  nodes: CommerceNode[],
  metric: HeightMetric,
): Map<string, number> {
  const sums = new Map<string, { sum: number; count: number }>()
  for (const node of nodes) {
    const value = getMetricValue(node, metric)
    if (!Number.isFinite(value)) continue
    const prev = sums.get(node.district) ?? { sum: 0, count: 0 }
    sums.set(node.district, { sum: prev.sum + value, count: prev.count + 1 })
  }
  const result = new Map<string, number>()
  for (const [district, { sum, count }] of sums) {
    result.set(district, count > 0 ? sum / count : 0)
  }
  return result
}

export function getDistrictCentroids(
  nodes: CommerceNode[],
): Map<string, [number, number]> {
  const sums = new Map<string, { x: number; y: number; count: number }>()
  for (const node of nodes) {
    const prev = sums.get(node.district) ?? { x: 0, y: 0, count: 0 }
    sums.set(node.district, {
      x: prev.x + node.coordinates[0],
      y: prev.y + node.coordinates[1],
      count: prev.count + 1,
    })
  }
  const result = new Map<string, [number, number]>()
  for (const [district, { x, y, count }] of sums) {
    if (count > 0) result.set(district, [x / count, y / count])
  }
  return result
}

export function getDongToDistrictMap(
  nodes: CommerceNode[],
): Map<string, string> {
  const result = new Map<string, string>()
  for (const node of nodes) {
    if (!node.admKey) continue
    const parts = node.admKey.split('_')
    if (parts.length !== 2) continue
    const [district, dong] = parts
    result.set(dong, district)
  }
  return result
}
