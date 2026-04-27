import { describe, it, expect } from 'vitest'
import { filterNodesByDistrict, filterNodesByType } from './filters'
import type { CommerceNode } from '../types/commerce'

const NODES: CommerceNode[] = [
  {
    id: 'gc_001', name: '강남역 상권', coordinates: [127.027, 37.497],
    type: '흡수형_과열', district: '강남구', netFlow: 1200, degreeCentrality: 0.95, griScore: 88,
  },
  {
    id: 'gc_002', name: '역삼동 상권', coordinates: [127.035, 37.500],
    type: '흡수형_성장', district: '강남구', netFlow: 780, degreeCentrality: 0.82, griScore: 74,
  },
  {
    id: 'gw_001', name: '신림역 상권', coordinates: [126.929, 37.484],
    type: '방출형_침체', district: '관악구', netFlow: -380, degreeCentrality: 0.42, griScore: 62,
  },
  {
    id: 'gw_002', name: '봉천동 상권', coordinates: [126.937, 37.487],
    type: '방출형_침체', district: '관악구', netFlow: -220, degreeCentrality: 0.31, griScore: 58,
  },
  {
    id: 'gw_003', name: '낙성대 상권', coordinates: [126.963, 37.479],
    type: '고립형_단절', district: '관악구', netFlow: -500, degreeCentrality: 0.08, griScore: 41,
  },
]

const NODES_WITH_UNCLASSIFIED: CommerceNode[] = [
  ...NODES,
  {
    id: 'uc_001', name: '분석 대기 상권', coordinates: [127.001, 37.501],
    type: '미분류', district: '강남구', netFlow: 0, degreeCentrality: 0, griScore: 0,
  },
]

describe('filterNodesByDistrict', () => {
  it('빈 Set이면 전체를 반환한다', () => {
    expect(filterNodesByDistrict(NODES, new Set())).toHaveLength(5)
  })

  it('강남구만 선택하면 강남구 노드만 반환한다', () => {
    const result = filterNodesByDistrict(NODES, new Set(['강남구']))
    expect(result).toHaveLength(2)
    expect(result.every(n => n.district === '강남구')).toBe(true)
  })

  it('관악구만 선택하면 관악구 노드만 반환한다', () => {
    const result = filterNodesByDistrict(NODES, new Set(['관악구']))
    expect(result).toHaveLength(3)
    expect(result.every(n => n.district === '관악구')).toBe(true)
  })

  it('둘 다 선택하면 전체를 반환한다', () => {
    const result = filterNodesByDistrict(NODES, new Set(['강남구', '관악구']))
    expect(result).toHaveLength(5)
  })

  it('원본 배열을 변경하지 않는다 (불변성)', () => {
    const original = [...NODES]
    filterNodesByDistrict(NODES, new Set(['강남구']))
    expect(NODES).toEqual(original)
  })
})

describe('filterNodesByType', () => {
  it('빈 Set이면 전체를 반환한다', () => {
    expect(filterNodesByType(NODES, new Set())).toHaveLength(5)
  })

  it('흡수형_과열만 선택하면 해당 노드만 반환한다', () => {
    const result = filterNodesByType(NODES, new Set(['흡수형_과열']))
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('gc_001')
  })

  it('방출형_침체 + 고립형_단절 선택 시 해당 노드를 반환한다', () => {
    const result = filterNodesByType(NODES, new Set(['방출형_침체', '고립형_단절']))
    expect(result).toHaveLength(3)
  })

  it('원본 배열을 변경하지 않는다 (불변성)', () => {
    const original = [...NODES]
    filterNodesByType(NODES, new Set(['안정형']))
    expect(NODES).toEqual(original)
  })

  it('미분류만 선택 시 미분류 노드만 남는다', () => {
    const result = filterNodesByType(NODES_WITH_UNCLASSIFIED, new Set(['미분류']))
    expect(result).toHaveLength(1)
    expect(result.every(n => n.type === '미분류')).toBe(true)
  })
})
