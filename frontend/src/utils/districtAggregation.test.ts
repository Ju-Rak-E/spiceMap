import { describe, it, expect } from 'vitest'
import {
  aggregateMetricByDistrict,
  getDistrictCentroids,
  getDongToDistrictMap,
} from './districtAggregation'
import type { CommerceNode } from '../types/commerce'

const NODES: CommerceNode[] = [
  { id: 'g1', name: '강남A', coordinates: [127.02, 37.50], type: '흡수형_과열', district: '강남구', admKey: '강남구_역삼동', netFlow: 100, degreeCentrality: 0.8, griScore: 80, closeRate: 5 },
  { id: 'g2', name: '강남B', coordinates: [127.04, 37.51], type: '안정형',     district: '강남구', admKey: '강남구_삼성동', netFlow: 200, degreeCentrality: 0.6, griScore: 60, closeRate: 7 },
  { id: 'k1', name: '관악A', coordinates: [126.95, 37.48], type: '방출형_침체', district: '관악구', admKey: '관악구_봉천동', netFlow: -100, degreeCentrality: 0.3, griScore: 40, closeRate: 12 },
]

describe('aggregateMetricByDistrict', () => {
  it('자치구별 평균 metric을 반환한다', () => {
    const result = aggregateMetricByDistrict(NODES, 'griScore')
    expect(result.get('강남구')).toBe(70)  // (80+60)/2
    expect(result.get('관악구')).toBe(40)
  })

  it('빈 배열이면 빈 맵', () => {
    expect(aggregateMetricByDistrict([], 'griScore').size).toBe(0)
  })

  it('district가 같으면 합산 후 평균', () => {
    const result = aggregateMetricByDistrict(NODES, 'netFlow')
    expect(result.get('강남구')).toBe(150)  // (100+200)/2
  })
})

describe('getDistrictCentroids', () => {
  it('자치구별 노드들의 평균 좌표를 centroid로 반환', () => {
    const result = getDistrictCentroids(NODES)
    const gangnam = result.get('강남구')!
    expect(gangnam[0]).toBeCloseTo(127.03, 5)  // (127.02+127.04)/2
    expect(gangnam[1]).toBeCloseTo(37.505, 5)  // (37.50+37.51)/2
  })

  it('한 노드만 있는 자치구는 그 노드의 좌표', () => {
    const result = getDistrictCentroids(NODES)
    expect(result.get('관악구')).toEqual([126.95, 37.48])
  })
})

describe('getDongToDistrictMap', () => {
  it('admKey "강남구_역삼동" → "역삼동" → "강남구" 매핑', () => {
    const result = getDongToDistrictMap(NODES)
    expect(result.get('역삼동')).toBe('강남구')
    expect(result.get('삼성동')).toBe('강남구')
    expect(result.get('봉천동')).toBe('관악구')
  })

  it('admKey 없는 노드는 무시', () => {
    const noKey: CommerceNode = { ...NODES[0], admKey: undefined }
    const result = getDongToDistrictMap([noKey])
    expect(result.size).toBe(0)
  })
})
