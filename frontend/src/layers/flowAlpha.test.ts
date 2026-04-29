import { describe, it, expect } from 'vitest'
import type { ODFlow } from '../hooks/useFlowData'

import { getFlowAlpha, getFlowWidth } from './ODFlowLayer'

const makeFlow = (sourceId: string, targetId: string): ODFlow => ({
  id: `${sourceId}-${targetId}`,
  sourceId,
  targetId,
  sourceCoord: [126.9, 37.5],
  targetCoord: [126.95, 37.52],
  volume: 5000,
  purpose: '출근',
})

describe('getFlowAlpha', () => {
  it('selectedId가 null이면 기본 알파 140을 반환한다', () => {
    expect(getFlowAlpha(makeFlow('A', 'B'), null)).toBe(140)
  })
  it('관련 흐름(origin 일치)은 알파 200을 반환한다', () => {
    expect(getFlowAlpha(makeFlow('SELECTED', 'B'), 'SELECTED')).toBe(200)
  })
  it('관련 흐름(dest 일치)은 알파 200을 반환한다', () => {
    expect(getFlowAlpha(makeFlow('A', 'SELECTED'), 'SELECTED')).toBe(200)
  })
  it('무관 흐름은 알파 20을 반환한다', () => {
    expect(getFlowAlpha(makeFlow('A', 'B'), 'SELECTED')).toBe(20)
  })
})

describe('getFlowWidth', () => {
  it('selectedId가 null이면 volume 비례 폭을 반환한다', () => {
    const base = getFlowWidth(5000, null, makeFlow('A', 'B'))
    expect(base).toBeGreaterThan(1.5)
    expect(base).toBeLessThan(8)
  })
  it('관련 흐름 폭은 기본값의 1.5배이다', () => {
    const base = getFlowWidth(5000, null, makeFlow('A', 'B'))
    const highlighted = getFlowWidth(5000, 'A', makeFlow('A', 'B'))
    expect(highlighted).toBeCloseTo(base * 1.5, 1)
  })
})
