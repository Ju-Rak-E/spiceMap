import type { CommerceType } from '../styles/tokens'

export interface CommerceNode {
  id: string
  name: string
  coordinates: [number, number]  // [lng, lat]
  type: CommerceType
  sourceCommType?: string | null  // 서울시 원본 상권 구분
  district: string               // 자치구명 (예: '강남구')
  netFlow: number                // 순유입 (양수=유입, 음수=유출)
  degreeCentrality: number       // 0~1
  griScore: number               // 0~100
  closeRate?: number             // 폐업률 (%) — OA-15577
}

// Dev-A API: GeoJSON FeatureCollection 응답 타입
export interface CommerceFeatureProperties {
  comm_cd: string
  comm_nm: string
  gu_nm?: string | null
  commerce_type?: string | null
  source_comm_type?: string | null
  comm_type: string | null
  gri_score: number | null
  flow_volume: number | null
  net_flow?: number | null
  degree_centrality?: number | null
  close_rate?: number | null
  dominant_origin: string | null
  analysis_note: string | null
  centroid_lng: number | null
  centroid_lat: number | null
}

export interface CommerceFeature {
  type: 'Feature'
  geometry: { type: string; coordinates: unknown }
  properties: CommerceFeatureProperties
}

export interface CommerceTypeMapResponse {
  type: 'FeatureCollection'
  quarter: string
  total: number
  features: CommerceFeature[]
}

const VALID_TYPES = new Set([
  '흡수형_과열', '흡수형_성장', '방출형_침체', '고립형_단절', '안정형', '미분류',
])

function resolveType(raw: string | null): CommerceType {
  if (!raw) return '미분류'
  if (raw === 'unclassified') return '미분류'
  if (raw && VALID_TYPES.has(raw)) return raw as CommerceType
  return '미분류'
}

function resolveCentroid(
  props: CommerceFeatureProperties,
  geometry: { type: string; coordinates: unknown },
): [number, number] | null {
  if (props.centroid_lng != null && props.centroid_lat != null) {
    return [props.centroid_lng, props.centroid_lat]
  }
  // 폴백: Polygon bbox 중심 계산
  try {
    let ring: number[][]
    if (geometry.type === 'Polygon') {
      ring = (geometry.coordinates as number[][][])[0]
    } else if (geometry.type === 'MultiPolygon') {
      ring = (geometry.coordinates as number[][][][])[0][0]
    } else {
      return null
    }
    const lngs = ring.map(c => c[0])
    const lats = ring.map(c => c[1])
    return [
      (Math.min(...lngs) + Math.max(...lngs)) / 2,
      (Math.min(...lats) + Math.max(...lats)) / 2,
    ]
  } catch {
    return null
  }
}

function formatCommerceName(raw: string): string {
  if (/(상권|시장|관광특구|거리|로|길|일대)$/.test(raw)) return raw
  return `${raw} 일대`
}

export function featuresToNodes(features: CommerceFeature[]): CommerceNode[] {
  const nodes: CommerceNode[] = []
  for (const f of features) {
    const coords = resolveCentroid(f.properties, f.geometry)
    if (!coords) continue
    nodes.push({
      id: f.properties.comm_cd,
      name: formatCommerceName(f.properties.comm_nm),
      coordinates: coords,
      type: resolveType(f.properties.commerce_type ?? f.properties.comm_type ?? null),
      sourceCommType: f.properties.source_comm_type ?? f.properties.comm_type ?? null,
      district: f.properties.gu_nm ?? '',
      netFlow: f.properties.net_flow ?? 0,
      degreeCentrality: f.properties.degree_centrality ?? 0,
      griScore: f.properties.gri_score ?? 0,
      closeRate: f.properties.close_rate ?? undefined,
    })
  }
  return nodes
}
