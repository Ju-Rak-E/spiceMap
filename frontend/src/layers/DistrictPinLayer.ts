import { ScatterplotLayer } from '@deck.gl/layers'
import type { CommerceNode } from '../types/commerce'
import type { HeightMetric } from '../utils/threeDUtils'
import { aggregateMetricByDistrict, getDistrictCentroids } from '../utils/districtAggregation'

const MIN_RADIUS_M = 80
const MAX_RADIUS_M = 220
const RADIUS_MIN_PIXELS = 6
const RADIUS_MAX_PIXELS = 22
const MAX_PIN_COUNT = 3
const PIN_OFFSET_DEG = 0.0035
const PIN_FILL: [number, number, number, number] = [231, 76, 60, 230]
const PIN_STROKE: [number, number, number, number] = [255, 255, 255, 255]

export interface DistrictPinDatum {
  id: string
  district: string
  position: [number, number]
  size: number
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function pinOffset(index: number, count: number): [number, number] {
  if (count === 1) return [0, 0]
  const angle = (Math.PI * 2 * index) / count
  return [Math.cos(angle) * PIN_OFFSET_DEG, Math.sin(angle) * PIN_OFFSET_DEG]
}

export function buildDistrictPinData(
  nodes: CommerceNode[],
  metric: HeightMetric,
): DistrictPinDatum[] {
  if (nodes.length === 0) return []
  const districtMetric = aggregateMetricByDistrict(nodes, metric)
  const centroids = getDistrictCentroids(nodes)
  const values = Array.from(districtMetric.values())
  if (values.length === 0) return []
  const min = Math.min(...values)
  const max = Math.max(...values)

  const data: DistrictPinDatum[] = []
  for (const [district, value] of districtMetric) {
    const centroid = centroids.get(district)
    if (!centroid) continue
    const intensity = max === min ? 0.5 : clamp01((value - min) / (max - min))
    const count = Math.max(1, Math.min(MAX_PIN_COUNT, Math.round(1 + intensity * (MAX_PIN_COUNT - 1))))
    const size = MIN_RADIUS_M + intensity * (MAX_RADIUS_M - MIN_RADIUS_M)
    for (let i = 0; i < count; i += 1) {
      const [dx, dy] = pinOffset(i, count)
      data.push({
        id: `${district}-${i}`,
        district,
        position: [centroid[0] + dx, centroid[1] + dy],
        size,
      })
    }
  }
  return data
}

export function createDistrictPinLayer(
  nodes: CommerceNode[],
  metric: HeightMetric,
): ScatterplotLayer<DistrictPinDatum> {
  const data = buildDistrictPinData(nodes, metric)
  return new ScatterplotLayer<DistrictPinDatum>({
    id: 'district-pin',
    data,
    getPosition: (d) => d.position,
    getRadius: (d) => d.size,
    getFillColor: () => PIN_FILL,
    getLineColor: () => PIN_STROKE,
    radiusUnits: 'meters',
    radiusMinPixels: RADIUS_MIN_PIXELS,
    radiusMaxPixels: RADIUS_MAX_PIXELS,
    stroked: true,
    lineWidthMinPixels: 1.5,
    pickable: false,
    updateTriggers: {
      getPosition: [metric, nodes.length],
      getRadius: [metric, nodes.length],
    },
  })
}
