import { describe, it, expect } from 'vitest'
import { ColumnLayer } from '@deck.gl/layers'
import { buildCommerceColumnData, createCommerceColumnLayer } from './CommerceColumnLayer'
import type { CommerceNode } from '../types/commerce'

const nodes: CommerceNode[] = [
  {
    id: 'gc_001',
    name: '강남역',
    coordinates: [127.02, 37.49],
    type: '흡수형_과열',
    district: '강남구',
    netFlow: 2000,
    degreeCentrality: 0.8,
    griScore: 80,
    closeRate: 10,
  },
  {
    id: 'gc_002',
    name: '역삼동',
    coordinates: [127.03, 37.5],
    type: '안정형',
    district: '강남구',
    netFlow: 50,
    degreeCentrality: 0.3,
    griScore: 30,
    closeRate: 2,
  },
]

describe('createCommerceColumnLayer', () => {
  it('ColumnLayer 인스턴스를 반환한다', () => {
    const layer = createCommerceColumnLayer(nodes, 'griScore')
    expect(layer).toBeInstanceOf(ColumnLayer)
  })

  it('레이어 id가 "commerce-3d-columns"', () => {
    const layer = createCommerceColumnLayer(nodes, 'griScore')
    expect(layer.id).toBe('commerce-3d-columns')
  })

  it('extruded: true (3D 기둥)', () => {
    const layer = createCommerceColumnLayer(nodes, 'griScore')
    expect(layer.props.extruded).toBe(true)
  })

  it('빈 nodes 배열에서도 에러 없이 생성', () => {
    expect(() => createCommerceColumnLayer([], 'griScore')).not.toThrow()
  })

  it('metric 변경 시 updateTriggers 다름', () => {
    const l1 = createCommerceColumnLayer(nodes, 'griScore')
    const l2 = createCommerceColumnLayer(nodes, 'netFlow')
    expect(l1.props.updateTriggers).not.toEqual(l2.props.updateTriggers)
  })

  it('material prop이 설정됨 (라이팅 적용)', () => {
    const layer = createCommerceColumnLayer(nodes, 'griScore')
    expect(layer.props.material).toBeDefined()
  })

  it('stroked: true + 흰색 반투명 라인', () => {
    const layer = createCommerceColumnLayer(nodes, 'griScore')
    expect(layer.props.stroked).toBe(true)
  })

  it('onHover 미지정 시 pickable: false', () => {
    const layer = createCommerceColumnLayer(nodes, 'griScore')
    expect(layer.props.pickable).toBe(false)
  })

  it('onHover 지정 시 pickable: true + onHover 콜백 연결', () => {
    const onHover = () => {}
    const layer = createCommerceColumnLayer(nodes, 'griScore', 1, onHover)
    expect(layer.props.pickable).toBe(true)
    expect(layer.props.onHover).toBe(onHover)
  })
})

describe('buildCommerceColumnData', () => {
  it('각 노드마다 1개 데이터 반환', () => {
    const data = buildCommerceColumnData(nodes, 'griScore')
    expect(data).toHaveLength(nodes.length)
  })

  it('값이 큰 노드의 elevation이 더 크다 (griScore)', () => {
    const data = buildCommerceColumnData(nodes, 'griScore')
    const high = data.find((d) => d.id === 'gc_001')!
    const low = data.find((d) => d.id === 'gc_002')!
    expect(high.elevation).toBeGreaterThan(low.elevation)
  })

  it('progress=0 시 모든 elevation이 0', () => {
    const data = buildCommerceColumnData(nodes, 'griScore', 0)
    for (const d of data) {
      expect(d.elevation).toBe(0)
    }
  })

  it('progress=0.5 시 elevation 절반', () => {
    const full = buildCommerceColumnData(nodes, 'griScore', 1)
    const half = buildCommerceColumnData(nodes, 'griScore', 0.5)
    const fullHigh = full.find((d) => d.id === 'gc_001')!
    const halfHigh = half.find((d) => d.id === 'gc_001')!
    expect(halfHigh.elevation).toBeCloseTo(fullHigh.elevation * 0.5, 5)
  })

  it('color는 RGB 튜플이며 metric 램프 색상', () => {
    const data = buildCommerceColumnData(nodes, 'griScore')
    for (const d of data) {
      expect(d.color).toHaveLength(4) // RGBA
      expect(d.color[0]).toBeGreaterThanOrEqual(0)
      expect(d.color[0]).toBeLessThanOrEqual(255)
    }
  })

  it('동일 값(min===max)이어도 NaN 없이 처리', () => {
    const flat: CommerceNode[] = [
      { ...nodes[0], griScore: 50 },
      { ...nodes[1], griScore: 50 },
    ]
    const data = buildCommerceColumnData(flat, 'griScore')
    for (const d of data) {
      expect(Number.isFinite(d.elevation)).toBe(true)
      for (const c of d.color) {
        expect(Number.isFinite(c)).toBe(true)
      }
    }
  })

  it('position은 노드 좌표 그대로', () => {
    const data = buildCommerceColumnData(nodes, 'griScore')
    const high = data.find((d) => d.id === 'gc_001')!
    expect(high.position).toEqual(nodes[0].coordinates)
  })

  it('각 datum에 name 필드 (hover 노출용)', () => {
    const data = buildCommerceColumnData(nodes, 'griScore')
    const high = data.find((d) => d.id === 'gc_001')!
    expect(high.name).toBe('강남역')
  })

  it('각 datum에 value 필드 (hover 노출용)', () => {
    const data = buildCommerceColumnData(nodes, 'griScore')
    const high = data.find((d) => d.id === 'gc_001')!
    expect(high.value).toBe(80)
  })

  it('renders positive closeRate with visible minimum height', () => {
    const closeNodes: CommerceNode[] = [
      { ...nodes[0], closeRate: 2.1 },
      { ...nodes[1], closeRate: 3.0 },
    ]
    const data = buildCommerceColumnData(closeNodes, 'closeRate')
    const low = data.find((d) => d.id === 'gc_001')!
    expect(low.elevation).toBeGreaterThan(0)
  })
})
