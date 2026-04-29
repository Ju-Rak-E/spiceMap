import type { CommerceNode } from '../types/commerce'
import { COMMERCE_COLORS } from '../styles/tokens'
import { deriveStartupSummary } from './startupAdvisor'

export interface AdminBoundaryFeature {
  type: 'Feature'
  properties: {
    code: string
    name: string
    gu_code?: string | null
  }
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: number[][][] | number[][][][]
  }
}

export interface AdminBoundaryCollection {
  type: 'FeatureCollection'
  features: AdminBoundaryFeature[]
}

export interface MapSummaryBadge {
  id: string
  label: string
  coord: [number, number]
  candidateCount: number
  bestScore: number
  dominantTypeLabel: string
}

interface SummaryAccumulator {
  id: string
  label: string
  lngSum: number
  latSum: number
  total: number
  candidateCount: number
  bestScore: number
  typeCounts: Map<string, number>
}

function isRecommended(node: CommerceNode): boolean {
  return deriveStartupSummary(node).fitLevel === 'recommended'
}

function addNode(acc: SummaryAccumulator, node: CommerceNode) {
  acc.lngSum += node.coordinates[0]
  acc.latSum += node.coordinates[1]
  acc.total += 1

  if (isRecommended(node)) {
    acc.candidateCount += 1
    acc.bestScore = Math.max(acc.bestScore, deriveStartupSummary(node).fitScore)
  }

  const typeLabel = COMMERCE_COLORS[node.type].label
  acc.typeCounts.set(typeLabel, (acc.typeCounts.get(typeLabel) ?? 0) + 1)
}

function toBadge(acc: SummaryAccumulator): MapSummaryBadge | null {
  if (acc.total === 0 || acc.candidateCount === 0) return null
  const dominantTypeLabel =
    [...acc.typeCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '-'

  return {
    id: acc.id,
    label: acc.label,
    coord: [acc.lngSum / acc.total, acc.latSum / acc.total],
    candidateCount: acc.candidateCount,
    bestScore: acc.bestScore,
    dominantTypeLabel,
  }
}

export function buildDistrictSummaries(nodes: CommerceNode[]): MapSummaryBadge[] {
  const byDistrict = new Map<string, SummaryAccumulator>()

  for (const node of nodes) {
    const key = node.district || 'unknown'
    const label = node.district || 'Unknown'
    if (!byDistrict.has(key)) {
      byDistrict.set(key, {
        id: `district-${key}`,
        label,
        lngSum: 0,
        latSum: 0,
        total: 0,
        candidateCount: 0,
        bestScore: 0,
        typeCounts: new Map(),
      })
    }
    addNode(byDistrict.get(key)!, node)
  }

  return [...byDistrict.values()]
    .map(toBadge)
    .filter((badge): badge is MapSummaryBadge => badge !== null)
    .sort((a, b) => b.bestScore - a.bestScore)
}

function getRings(feature: AdminBoundaryFeature): number[][][] {
  if (feature.geometry.type === 'Polygon') {
    return feature.geometry.coordinates as number[][][]
  }

  return (feature.geometry.coordinates as number[][][][]).flat()
}

function getFeatureCenter(feature: AdminBoundaryFeature): [number, number] {
  const points = getRings(feature).flat()
  const lngs = points.map((point) => point[0])
  const lats = points.map((point) => point[1])
  return [
    (Math.min(...lngs) + Math.max(...lngs)) / 2,
    (Math.min(...lats) + Math.max(...lats)) / 2,
  ]
}

function isPointInRing(point: [number, number], ring: number[][]): boolean {
  const [x, y] = point
  let inside = false

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    const intersects = yi > y !== yj > y
      && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }

  return inside
}

function isPointInFeature(point: [number, number], feature: AdminBoundaryFeature): boolean {
  if (feature.geometry.type === 'Polygon') {
    const rings = feature.geometry.coordinates as number[][][]
    return isPointInRing(point, rings[0])
  }

  const polygons = feature.geometry.coordinates as number[][][][]
  return polygons.some((polygon) => isPointInRing(point, polygon[0]))
}

export function buildDongSummaries(
  nodes: CommerceNode[],
  boundaries: AdminBoundaryCollection | null,
): MapSummaryBadge[] {
  if (!boundaries) return []

  const recommendedNodes = nodes.filter(isRecommended)
  const byDong = new Map<string, SummaryAccumulator>()

  for (const node of recommendedNodes) {
    const feature = boundaries.features.find((candidate) =>
      isPointInFeature(node.coordinates, candidate),
    )
    if (!feature) continue

    const key = feature.properties.code
    if (!byDong.has(key)) {
      const center = getFeatureCenter(feature)
      byDong.set(key, {
        id: `dong-${key}`,
        label: feature.properties.name,
        lngSum: center[0],
        latSum: center[1],
        total: 1,
        candidateCount: 0,
        bestScore: 0,
        typeCounts: new Map(),
      })
    }

    const acc = byDong.get(key)!
    acc.candidateCount += 1
    acc.bestScore = Math.max(acc.bestScore, deriveStartupSummary(node).fitScore)
    const typeLabel = COMMERCE_COLORS[node.type].label
    acc.typeCounts.set(typeLabel, (acc.typeCounts.get(typeLabel) ?? 0) + 1)
  }

  return [...byDong.values()]
    .map(toBadge)
    .filter((badge): badge is MapSummaryBadge => badge !== null)
    .sort((a, b) => b.bestScore - a.bestScore)
    .slice(0, 40)
}
