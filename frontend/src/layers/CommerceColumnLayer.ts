import { ColumnLayer } from '@deck.gl/layers'
import type { CommerceNode } from '../types/commerce'
import type { HeightMetric } from '../hooks/use3DView'
import { hexToRgba } from '../utils/colorUtils'
import { COMMERCE_COLORS } from '../styles/tokens'
import { getMetricValue, normalizeElevation } from '../utils/threeDUtils'

const MAX_ELEVATION = 400
const COLUMN_RADIUS = 80
const DISK_RESOLUTION = 6

export function createCommerceColumnLayer(
  nodes: CommerceNode[],
  metric: HeightMetric,
): ColumnLayer<CommerceNode> {
  const values = nodes.map((n) => getMetricValue(n, metric))
  const min = nodes.length > 0 ? Math.min(...values) : 0
  const max = nodes.length > 0 ? Math.max(...values) : 0
  return new ColumnLayer<CommerceNode>({
    id: 'commerce-column',
    data: nodes,
    diskResolution: DISK_RESOLUTION,
    radius: COLUMN_RADIUS,
    extruded: true,
    getPosition: (n) => [n.coordinates[0], n.coordinates[1], 0],
    getElevation: (n) => normalizeElevation(getMetricValue(n, metric), min, max, MAX_ELEVATION),
    getFillColor: (n) => hexToRgba(COMMERCE_COLORS[n.type].fill, 220),
    getLineColor: [0, 0, 0, 0],
    pickable: false,
    updateTriggers: {
      getElevation: [metric, nodes.length],
      getFillColor: [nodes.length],
    },
  })
}
