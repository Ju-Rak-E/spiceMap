import { PolygonLayer } from '@deck.gl/layers'
import type { CommerceNode } from '../types/commerce'
import type { BoundaryFeature, HeightMetric } from '../hooks/use3DView'
import { hexToRgba } from '../utils/colorUtils'
import { COMMERCE_COLORS } from '../styles/tokens'
import { getMetricValue, normalizeElevation } from '../utils/threeDUtils'

const MAX_ELEVATION = 3000

interface PolygonDatum {
  id: string
  polygon: number[][]
  elevation: number
  color: [number, number, number, number]
}

export function buildPolygonExtrusionData(
  nodes: CommerceNode[],
  boundaries: BoundaryFeature[],
  metric: HeightMetric,
  progress = 1,
): PolygonDatum[] {
  const clampedProgress = Math.max(0, Math.min(1, progress))
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const values  = nodes.map((n) => getMetricValue(n, metric))
  const min = Math.min(...values)
  const max = Math.max(...values)
  const data: PolygonDatum[] = []
  for (const boundary of boundaries) {
    const node = nodeMap.get(boundary.comm_id)
    if (!node) continue
    const baseElevation = normalizeElevation(getMetricValue(node, metric), min, max, MAX_ELEVATION)
    data.push({
      id: node.id,
      polygon: boundary.polygon,
      elevation: baseElevation * clampedProgress,
      color: hexToRgba(COMMERCE_COLORS[node.type].fill, 200),
    })
  }
  return data
}

export function createPolygonExtrusionLayer(
  nodes: CommerceNode[],
  boundaries: BoundaryFeature[],
  metric: HeightMetric,
  progress = 1,
): PolygonLayer<PolygonDatum> {
  const data = buildPolygonExtrusionData(nodes, boundaries, metric, progress)
  return new PolygonLayer<PolygonDatum>({
    id: 'commerce-polygon-extrusion',
    data,
    extruded: true,
    stroked: false,
    getPolygon:   (d) => d.polygon,
    getElevation: (d) => d.elevation,
    getFillColor: (d) => d.color,
    pickable: false,
    updateTriggers: {
      getElevation: [metric, nodes.length, progress],
      getFillColor: [nodes.length],
    },
  })
}
