import { PolygonLayer } from '@deck.gl/layers'
import type { PickingInfo } from '@deck.gl/core'
import type { CommerceNode } from '../types/commerce'
import type { BoundaryFeature, HeightMetric } from '../hooks/use3DView'
import { getMetricValue, normalizeElevation } from '../utils/threeDUtils'
import { rampColor, getRampForMetric } from '../utils/colorRamp'

const MAX_ELEVATION = 3000

export interface PolygonDatum {
  id: string
  name: string
  value: number
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
  const ramp = getRampForMetric(metric)
  const data: PolygonDatum[] = []
  for (const boundary of boundaries) {
    const node = nodeMap.get(boundary.comm_id)
    if (!node) continue
    const value = getMetricValue(node, metric)
    const baseElevation = normalizeElevation(value, min, max, MAX_ELEVATION)
    const t = max === min ? 0.5 : (value - min) / (max - min)
    const [r, g, b] = rampColor(t, ramp)
    data.push({
      id: node.id,
      name: node.name,
      value,
      polygon: boundary.polygon,
      elevation: baseElevation * clampedProgress,
      color: [r, g, b, 220],
    })
  }
  return data
}

export function createPolygonExtrusionLayer(
  nodes: CommerceNode[],
  boundaries: BoundaryFeature[],
  metric: HeightMetric,
  progress = 1,
  onHover?: (info: PickingInfo<PolygonDatum>) => void,
): PolygonLayer<PolygonDatum> {
  const data = buildPolygonExtrusionData(nodes, boundaries, metric, progress)
  const pickable = Boolean(onHover)
  return new PolygonLayer<PolygonDatum>({
    id: 'commerce-polygon-extrusion',
    data,
    extruded: true,
    stroked: true,
    getPolygon:   (d) => d.polygon,
    getElevation: (d) => d.elevation,
    getFillColor: (d) => d.color,
    getLineColor: [255, 255, 255, 70],
    lineWidthMinPixels: 1,
    pickable,
    onHover,
    material: {
      ambient: 0.35,
      diffuse: 0.7,
      shininess: 48,
      specularColor: [80, 80, 80],
    },
    updateTriggers: {
      getElevation: [metric, nodes.length, progress],
      getFillColor: [nodes.length, metric],
    },
  })
}
