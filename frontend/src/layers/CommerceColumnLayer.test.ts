import { describe, it, expect } from 'vitest'
import { buildCommercePictogramData, createCommerceColumnLayer } from './CommerceColumnLayer'
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
  it('레이어 id가 "commerce-pictogram"', () => {
    const layer = createCommerceColumnLayer(nodes, 'griScore')
    expect(layer.id).toBe('commerce-pictogram')
  })

  it('sizeUnits가 "meters"여서 줌 레벨에 따라 화면상 크기가 자동 변한다', () => {
    const layer = createCommerceColumnLayer(nodes, 'griScore')
    expect(layer.props.sizeUnits).toBe('meters')
  })

  it('sizeMinPixels/sizeMaxPixels로 극단 줌에서의 크기를 가드한다', () => {
    const layer = createCommerceColumnLayer(nodes, 'griScore')
    expect(typeof layer.props.sizeMinPixels).toBe('number')
    expect(typeof layer.props.sizeMaxPixels).toBe('number')
    expect(layer.props.sizeMaxPixels).toBeGreaterThan(layer.props.sizeMinPixels)
  })

  it('빈 nodes 배열에서도 에러 없이 생성', () => {
    expect(() => createCommerceColumnLayer([], 'griScore')).not.toThrow()
  })

  it('metric 변경 시 updateTriggers 다름', () => {
    const l1 = createCommerceColumnLayer(nodes, 'griScore')
    const l2 = createCommerceColumnLayer(nodes, 'netFlow')
    expect(l1.props.updateTriggers).not.toEqual(l2.props.updateTriggers)
  })

  it('순유입이 큰 상권은 사람 픽토그램 수량이 더 많다', () => {
    const data = buildCommercePictogramData(nodes, 'netFlow')
    const high = data.filter((d) => d.nodeId === 'gc_001')
    const low = data.filter((d) => d.nodeId === 'gc_002')
    expect(high.length).toBeGreaterThan(low.length)
  })

  it('순유입이 큰 상권은 사람 픽토그램 크기도 더 크다', () => {
    const data = buildCommercePictogramData(nodes, 'netFlow')
    const high = data.find((d) => d.nodeId === 'gc_001')!
    const low = data.find((d) => d.nodeId === 'gc_002')!
    expect(high.size).toBeGreaterThan(low.size)
  })

  it('최대 강도 노드도 픽토그램은 3개를 넘지 않는다', () => {
    const data = buildCommercePictogramData(nodes, 'netFlow')
    const high = data.filter((d) => d.nodeId === 'gc_001')
    expect(high.length).toBeLessThanOrEqual(3)
  })

  it('최소 강도 노드도 최소 1개의 픽토그램은 표시된다', () => {
    const flatNodes: CommerceNode[] = nodes.map((n) => ({ ...n, netFlow: 0 }))
    const data = buildCommercePictogramData(flatNodes, 'netFlow')
    for (const node of flatNodes) {
      const count = data.filter((d) => d.nodeId === node.id).length
      expect(count).toBeGreaterThanOrEqual(1)
    }
  })
})
