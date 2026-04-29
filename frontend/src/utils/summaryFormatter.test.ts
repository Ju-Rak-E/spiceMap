import { describe, it, expect } from 'vitest'
import { buildSummaryText } from './summaryFormatter'
import type { CommerceNode } from '../types/commerce'

const makeNode = (id: string, griScore: number): CommerceNode => ({
  id,
  name: `상권${id}`,
  coordinates: [126.9, 37.5],
  type: '안정형',
  district: '강남구',
  netFlow: 0,
  degreeCentrality: 0.5,
  griScore,
})

const ALL_TYPES = new Set([
  '흡수형_과열', '흡수형_성장', '방출형_침체', '고립형_단절', '안정형', '미분류',
] as const) as Set<import('../styles/tokens').CommerceType>

describe('buildSummaryText', () => {
  it('전체 상권 수와 위험 상권 수를 포함한다', () => {
    const nodes = [makeNode('a', 80), makeNode('b', 50), makeNode('c', 30)]
    const text = buildSummaryText('출근', 8, 30, ALL_TYPES, nodes)
    expect(text).toContain('3개')
    expect(text).toContain('위험 상권 1개')
  })

  it('위험 상권이 없으면 0개를 표시한다', () => {
    const nodes = [makeNode('a', 30), makeNode('b', 40)]
    const text = buildSummaryText(null, 12, 10, ALL_TYPES, nodes)
    expect(text).toContain('위험 상권 0개')
  })

  it('nodes가 비어있으면 빈 문자열을 반환한다', () => {
    expect(buildSummaryText('출근', 8, 10, ALL_TYPES, [])).toBe('')
  })
})
