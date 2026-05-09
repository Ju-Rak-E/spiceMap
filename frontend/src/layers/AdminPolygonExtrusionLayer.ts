import { PolygonLayer } from '@deck.gl/layers'
import type { CommerceNode } from '../types/commerce'
import type { HeightMetric } from '../utils/threeDUtils'
import { normalizeElevation } from '../utils/threeDUtils'
import { aggregateMetricByDistrict, getDongToDistrictMap } from '../utils/districtAggregation'

const MAX_ELEVATION = 3000
const FILL_LAVENDER: [number, number, number, number] = [183, 165, 219, 220]
const FILL_FLAT: [number, number, number, number] = [200, 200, 215, 80]

export interface AdminBoundaryFeature {
  name: string
  gu_code: string
  polygon: number[][]
}

interface AdminPolygonDatum {
  name: string
  polygon: number[][]
  elevation: number
  color: [number, number, number, number]
}

export function buildAdminPolygonExtrusionData(
  nodes: CommerceNode[],
  features: AdminBoundaryFeature[],
  metric: HeightMetric,
  progress = 1,
): AdminPolygonDatum[] {
  const clamped = Math.max(0, Math.min(1, progress))
  const districtMetric = aggregateMetricByDistrict(nodes, metric)
  const dongToDistrict = getDongToDistrictMap(nodes)
  const values = Array.from(districtMetric.values())
  const min = values.length > 0 ? Math.min(...values) : 0
  const max = values.length > 0 ? Math.max(...values) : 0

  return features.map((feature) => {
    const district = dongToDistrict.get(feature.name)
    const value = district !== undefined ? districtMetric.get(district) : undefined
    const baseElevation = value !== undefined
      ? normalizeElevation(value, min, max, MAX_ELEVATION)
      : 0
    return {
      name: feature.name,
      polygon: feature.polygon,
      elevation: baseElevation * clamped,
      color: value !== undefined ? FILL_LAVENDER : FILL_FLAT,
    }
  })
}

export function createAdminPolygonExtrusionLayer(
  nodes: CommerceNode[],
  features: AdminBoundaryFeature[],
  metric: HeightMetric,
  progress = 1,
): PolygonLayer<AdminPolygonDatum> {
  const data = buildAdminPolygonExtrusionData(nodes, features, metric, progress)
  return new PolygonLayer<AdminPolygonDatum>({
    id: 'admin-polygon-extrusion',
    data,
    extruded: true,
    stroked: false,
    getPolygon: (d) => d.polygon,
    getElevation: (d) => d.elevation,
    getFillColor: (d) => d.color,
    pickable: false,
    updateTriggers: {
      getElevation: [metric, nodes.length, progress],
      getFillColor: [nodes.length],
    },
  })
}
