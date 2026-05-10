import { PolygonLayer } from '@deck.gl/layers'
import type { PickingInfo } from '@deck.gl/core'
import type { CommerceNode } from '../types/commerce'
import type { HeightMetric } from '../utils/threeDUtils'
import { normalizeElevation } from '../utils/threeDUtils'
import { aggregateMetricByDistrict, getDongToDistrictMap } from '../utils/districtAggregation'
import { rampColor, getRampForMetric } from '../utils/colorRamp'

const MAX_ELEVATION = 3000
const FILL_FLAT: [number, number, number, number] = [200, 200, 215, 80]

export interface AdminBoundaryFeature {
  name: string
  gu_code: string
  polygon: number[][]
}

export interface AdminPolygonDatum {
  name: string
  districtName: string | undefined
  value: number | undefined
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

  const ramp = getRampForMetric(metric)
  return features.map((feature) => {
    const district = dongToDistrict.get(feature.name)
    const value = district !== undefined ? districtMetric.get(district) : undefined
    const baseElevation = value !== undefined
      ? normalizeElevation(value, min, max, MAX_ELEVATION)
      : 0
    let color: [number, number, number, number] = FILL_FLAT
    if (value !== undefined) {
      const t = max === min ? 0.5 : (value - min) / (max - min)
      const [r, g, b] = rampColor(t, ramp)
      color = [r, g, b, 220]
    }
    return {
      name: feature.name,
      districtName: district,
      value,
      polygon: feature.polygon,
      elevation: baseElevation * clamped,
      color,
    }
  })
}

export function createAdminPolygonExtrusionLayer(
  nodes: CommerceNode[],
  features: AdminBoundaryFeature[],
  metric: HeightMetric,
  progress = 1,
  onHover?: (info: PickingInfo<AdminPolygonDatum>) => void,
): PolygonLayer<AdminPolygonDatum> {
  const data = buildAdminPolygonExtrusionData(nodes, features, metric, progress)
  const pickable = Boolean(onHover)
  return new PolygonLayer<AdminPolygonDatum>({
    id: 'admin-polygon-extrusion',
    data,
    extruded: true,
    stroked: false,
    getPolygon: (d) => d.polygon,
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
