import { PathLayer, PolygonLayer } from '@deck.gl/layers'
import type { PickingInfo, Position } from '@deck.gl/core'
import type { CommerceNode } from '../types/commerce'
import type { BoundaryFeature, HeightMetric } from '../hooks/use3DView'
import { getMetricValue, normalizeElevation } from '../utils/threeDUtils'
import { rampColor, getRampForMetric } from '../utils/colorRamp'

const MAX_ELEVATION = 3000
const MIN_CLOSE_RATE_ELEVATION = 250

export interface PolygonDatum {
  id: string
  name: string
  value: number
  polygon: number[][]
  elevation: number
  color: [number, number, number, number]
}

export interface PolygonOutlineDatum {
  id: string
  path: Position[]
  color: [number, number, number, number]
}

function closeRing(path: number[][]): Position[] {
  if (path.length === 0) return []
  const first = path[0]
  const last = path[path.length - 1]
  const ring = first[0] === last[0] && first[1] === last[1] ? path : [...path, first]
  return ring.map((point) => [point[0], point[1]] as const)
}

export function buildPolygonExtrusionData(
  nodes: CommerceNode[],
  boundaries: BoundaryFeature[],
  metric: HeightMetric,
  progress = 1,
): PolygonDatum[] {
  const clampedProgress = Math.max(0, Math.min(1, progress))
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const values = nodes
    .map((node) => {
      if (metric === 'closeRate' && node.closeRate == null) return undefined
      return getMetricValue(node, metric)
    })
    .filter((value): value is number => Number.isFinite(value))
  if (values.length === 0) return []
  const min = Math.min(...values)
  const max = Math.max(...values)
  const ramp = getRampForMetric(metric)
  const data: PolygonDatum[] = []
  for (const boundary of boundaries) {
    const node = nodeMap.get(boundary.comm_id)
    if (!node) continue
    if (metric === 'closeRate' && node.closeRate == null) continue
    const value = getMetricValue(node, metric)
    if (!Number.isFinite(value)) continue
    const baseElevation = normalizeElevation(value, min, max, MAX_ELEVATION)
    const elevation = metric === 'closeRate' && value > 0
      ? Math.max(baseElevation, MIN_CLOSE_RATE_ELEVATION)
      : baseElevation
    const t = max === min ? 0.5 : (value - min) / (max - min)
    const [r, g, b] = rampColor(t, ramp)
    data.push({
      id: node.id,
      name: node.name,
      value,
      polygon: boundary.polygon,
      elevation: elevation * clampedProgress,
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
    stroked: false,
    getPolygon:   (d) => d.polygon,
    getElevation: (d) => d.elevation,
    getFillColor: (d) => d.color,
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

export function createPolygonOutlineLayer(
  nodes: CommerceNode[],
  boundaries: BoundaryFeature[],
  metric: HeightMetric,
  progress = 1,
): PathLayer<PolygonOutlineDatum> {
  const data = buildPolygonExtrusionData(nodes, boundaries, metric, progress)
    .map((d) => ({
      id: d.id,
      path: closeRing(d.polygon),
      color: [255, 255, 255, 120] as [number, number, number, number],
    }))

  return new PathLayer<PolygonOutlineDatum>({
    id: 'commerce-polygon-outline',
    data,
    getPath: (d) => d.path,
    getColor: (d) => d.color,
    getWidth: 1.6,
    widthUnits: 'pixels',
    widthMinPixels: 1,
    jointRounded: true,
    capRounded: true,
    pickable: false,
    parameters: {
      depthCompare: 'always',
      depthWriteEnabled: false,
    },
    updateTriggers: {
      getPath: [nodes.length, metric, progress],
      getColor: [metric],
    },
  })
}
