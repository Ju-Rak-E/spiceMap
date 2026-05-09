import { describe, it, expect } from 'vitest'
import { buildDistrictPinData, createDistrictPinLayer } from './DistrictPinLayer'
import type { CommerceNode } from '../types/commerce'

const NODES: CommerceNode[] = [
  { id: 'g1', name: 'A', coordinates: [127.02, 37.50], type: '흡수형_과열', district: '강남구', netFlow: 1000, degreeCentrality: 0.9, griScore: 95, closeRate: 5 },
  { id: 'k1', name: 'B', coordinates: [126.95, 37.48], type: '안정형',     district: '관악구', netFlow: 50,   degreeCentrality: 0.3, griScore: 40, closeRate: 8 },
  { id: 'k2', name: 'C', coordinates: [126.96, 37.47], type: '방출형_침체', district: '관악구', netFlow: 100,  degreeCentrality: 0.4, griScore: 50, closeRate: 9 },
]

describe('buildDistrictPinData', () => {
  it('자치구별로 핀 데이터를 생성한다', () => {
    const data = buildDistrictPinData(NODES, 'griScore')
    const districts = new Set(data.map((d) => d.district))
    expect(districts.has('강남구')).toBe(true)
    expect(districts.has('관악구')).toBe(true)
  })

  it('강도가 높은 자치구는 핀이 더 많이 (1~3개)', () => {
    const data = buildDistrictPinData(NODES, 'griScore')
    const high = data.filter((d) => d.district === '강남구')
    const low = data.filter((d) => d.district === '관악구')
    expect(high.length).toBeGreaterThan(low.length)
    expect(high.length).toBeLessThanOrEqual(3)
    expect(low.length).toBeGreaterThanOrEqual(1)
  })

  it('강도가 높은 자치구는 핀 크기도 더 크다 (meters)', () => {
    const data = buildDistrictPinData(NODES, 'griScore')
    const high = data.find((d) => d.district === '강남구')!
    const low = data.find((d) => d.district === '관악구')!
    expect(high.size).toBeGreaterThan(low.size)
  })

  it('빈 nodes에서 빈 배열 반환', () => {
    expect(buildDistrictPinData([], 'griScore')).toEqual([])
  })
})

describe('createDistrictPinLayer', () => {
  it('레이어 id는 "district-pin"', () => {
    const layer = createDistrictPinLayer(NODES, 'griScore')
    expect(layer.id).toBe('district-pin')
  })

  it('sizeUnits "meters"로 줌 따라 자동 스케일', () => {
    const layer = createDistrictPinLayer(NODES, 'griScore')
    expect(layer.props.radiusUnits).toBe('meters')
  })

  it('radiusMinPixels/radiusMaxPixels로 극단 줌 가드', () => {
    const layer = createDistrictPinLayer(NODES, 'griScore')
    expect(typeof layer.props.radiusMinPixels).toBe('number')
    expect(typeof layer.props.radiusMaxPixels).toBe('number')
    expect(layer.props.radiusMaxPixels).toBeGreaterThan(layer.props.radiusMinPixels)
  })
})
