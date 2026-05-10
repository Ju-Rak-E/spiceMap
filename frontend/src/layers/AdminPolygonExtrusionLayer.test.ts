import { describe, it, expect } from 'vitest'
import { buildAdminPolygonExtrusionData, createAdminPolygonExtrusionLayer } from './AdminPolygonExtrusionLayer'
import type { CommerceNode } from '../types/commerce'
import type { AdminBoundaryFeature } from './AdminPolygonExtrusionLayer'

const NODES: CommerceNode[] = [
  { id: 'g1', name: '강남A', coordinates: [127.02, 37.50], type: '흡수형_과열', district: '강남구', admKey: '강남구_역삼동', netFlow: 100, degreeCentrality: 0.8, griScore: 80, closeRate: 5 },
  { id: 'k1', name: '관악A', coordinates: [126.95, 37.48], type: '방출형_침체', district: '관악구', admKey: '관악구_봉천동', netFlow: -100, degreeCentrality: 0.3, griScore: 40, closeRate: 12 },
]

const FEATURES: AdminBoundaryFeature[] = [
  { name: '역삼동', gu_code: 'A', polygon: [[127.02, 37.50], [127.03, 37.50], [127.03, 37.51], [127.02, 37.51]] },
  { name: '봉천동', gu_code: 'B', polygon: [[126.95, 37.48], [126.96, 37.48], [126.96, 37.49], [126.95, 37.49]] },
  { name: '미지의동', gu_code: 'C', polygon: [[127.10, 37.50], [127.11, 37.50], [127.11, 37.51], [127.10, 37.51]] },
]

describe('buildAdminPolygonExtrusionData', () => {
  it('admKey의 동명으로 자치구 매핑하여 elevation을 부여한다', () => {
    const data = buildAdminPolygonExtrusionData(NODES, FEATURES, 'griScore')
    const yeoksam = data.find((d) => d.name === '역삼동')
    expect(yeoksam).toBeDefined()
    expect(yeoksam!.elevation).toBeGreaterThan(0)
  })

  it('자치구 매핑이 없는 동은 elevation 0 (시각적으로 평면)', () => {
    const data = buildAdminPolygonExtrusionData(NODES, FEATURES, 'griScore')
    const unknown = data.find((d) => d.name === '미지의동')
    expect(unknown).toBeDefined()
    expect(unknown!.elevation).toBe(0)
  })

  it('같은 자치구의 모든 동은 동일한 elevation', () => {
    const multi: CommerceNode[] = [
      ...NODES,
      { ...NODES[0], id: 'g2', name: '강남B', coordinates: [127.04, 37.51], admKey: '강남구_삼성동', griScore: 60 },
    ]
    const features: AdminBoundaryFeature[] = [
      ...FEATURES,
      { name: '삼성동', gu_code: 'A', polygon: [[127.04, 37.51], [127.05, 37.51], [127.05, 37.52], [127.04, 37.52]] },
    ]
    const data = buildAdminPolygonExtrusionData(multi, features, 'griScore')
    const yeoksam = data.find((d) => d.name === '역삼동')!
    const samseong = data.find((d) => d.name === '삼성동')!
    expect(yeoksam.elevation).toBe(samseong.elevation)
  })

  it('progress 파라미터로 elevation 비례 축소', () => {
    const full = buildAdminPolygonExtrusionData(NODES, FEATURES, 'griScore', 1)
    const half = buildAdminPolygonExtrusionData(NODES, FEATURES, 'griScore', 0.5)
    const fullEl = full.find((d) => d.name === '역삼동')!.elevation
    const halfEl = half.find((d) => d.name === '역삼동')!.elevation
    expect(halfEl).toBeCloseTo(fullEl * 0.5, 5)
  })

  it('progress=0이면 모두 0', () => {
    const data = buildAdminPolygonExtrusionData(NODES, FEATURES, 'griScore', 0)
    for (const d of data) {
      expect(d.elevation).toBe(0)
    }
  })
})

describe('createAdminPolygonExtrusionLayer', () => {
  it('레이어 id는 "admin-polygon-extrusion"', () => {
    const layer = createAdminPolygonExtrusionLayer(NODES, FEATURES, 'griScore', 1)
    expect(layer.id).toBe('admin-polygon-extrusion')
  })

  it('stroked: false (행정동 경계가 보이지 않아야 자치구처럼 보인다)', () => {
    const layer = createAdminPolygonExtrusionLayer(NODES, FEATURES, 'griScore', 1)
    expect(layer.props.stroked).toBe(false)
  })

  it('onHover 미지정 시 pickable: false', () => {
    const layer = createAdminPolygonExtrusionLayer(NODES, FEATURES, 'griScore', 1)
    expect(layer.props.pickable).toBe(false)
  })

  it('onHover 지정 시 pickable: true + onHover 콜백 연결', () => {
    const onHover = () => {}
    const layer = createAdminPolygonExtrusionLayer(NODES, FEATURES, 'griScore', 1, onHover)
    expect(layer.props.pickable).toBe(true)
    expect(layer.props.onHover).toBe(onHover)
  })

  it('각 datum에 districtName/value 필드 (hover 노출용)', () => {
    const data = buildAdminPolygonExtrusionData(NODES, FEATURES, 'griScore')
    const yeoksam = data.find((d) => d.name === '역삼동')!
    expect(yeoksam.districtName).toBe('강남구')
    expect(yeoksam.value).toBeDefined()
  })
})
