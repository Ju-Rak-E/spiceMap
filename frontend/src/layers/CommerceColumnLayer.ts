import { ColumnLayer } from '@deck.gl/layers'
import type { PickingInfo } from '@deck.gl/core'
import type { CommerceNode } from '../types/commerce'
import type { HeightMetric } from '../hooks/use3DView'
import { getMetricValue } from '../utils/threeDUtils'
import { rampColor, getRampForMetric } from '../utils/colorRamp'

const RADIUS_METERS = 80
const MAX_ELEVATION_METERS = 600

export interface ColumnDatum {
  id: string
  name: string
  value: number
  position: [number, number]
  elevation: number
  color: [number, number, number, number]
}

export function buildCommerceColumnData(
  nodes: CommerceNode[],
  metric: HeightMetric,
  progress = 1,
): ColumnDatum[] {
  const clampedProgress = Math.max(0, Math.min(1, progress))
  if (nodes.length === 0) return []

  const values = nodes.map((n) => getMetricValue(n, metric))
  const min = Math.min(...values)
  const max = Math.max(...values)
  const ramp = getRampForMetric(metric)

  return nodes.map((node) => {
    const value = getMetricValue(node, metric)
    const t = max === min ? 0.5 : (value - min) / (max - min)
    const [r, g, b] = rampColor(t, ramp)
    return {
      id: node.id,
      name: node.name,
      value,
      position: node.coordinates,
      elevation: t * MAX_ELEVATION_METERS * clampedProgress,
      color: [r, g, b, 230],
    }
  })
}

export function createCommerceColumnLayer(
  nodes: CommerceNode[],
  metric: HeightMetric,
  progress = 1,
  onHover?: (info: PickingInfo<ColumnDatum>) => void,
): ColumnLayer<ColumnDatum> {
  const data = buildCommerceColumnData(nodes, metric, progress)
  const pickable = Boolean(onHover)
  return new ColumnLayer<ColumnDatum>({
    id: 'commerce-3d-columns',
    data,
    diskResolution: 16,
    radius: RADIUS_METERS,
    extruded: true,
    elevationScale: 1,
    getPosition: (d) => d.position,
    getElevation: (d) => d.elevation,
    getFillColor: (d) => d.color,
    getLineColor: [255, 255, 255, 90],
    stroked: true,
    lineWidthMinPixels: 1,
    pickable,
    onHover,
    material: {
      ambient: 0.4,
      diffuse: 0.65,
      shininess: 64,
      specularColor: [90, 90, 90],
    },
    updateTriggers: {
      getPosition: [nodes.length],
      getElevation: [metric, nodes.length, progress],
      getFillColor: [metric, nodes.length],
    },
  })
}
