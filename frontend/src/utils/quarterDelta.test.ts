import { describe, expect, it } from 'vitest'
import type { CommerceNode } from '../types/commerce'
import {
  computeKpi,
  computeKpiDelta,
  deltaTone,
  formatDelta,
  getPreviousQuarter,
} from './quarterDelta'

const makeNode = (id: string, griScore: number, netFlow: number): CommerceNode => ({
  id,
  name: id,
  coordinates: [127, 37.5],
  type: '안정형',
  district: '강남구',
  netFlow,
  degreeCentrality: 0.5,
  griScore,
  closeRate: 5,
})

describe('computeKpi', () => {
  it('빈 노드 배열은 모든 값 0을 반환한다 (totalVolume 제외)', () => {
    const kpi = computeKpi([], 1234)
    expect(kpi).toEqual({ totalVolume: 1234, avgGri: 0, commerceCount: 0, recommendedCount: 0 })
  })

  it('노드 개수, GRI 평균, 추천 수를 계산한다', () => {
    const nodes = [makeNode('a', 60, 500), makeNode('b', 80, 600)]
    const kpi = computeKpi(nodes, 10000)
    expect(kpi.totalVolume).toBe(10000)
    expect(kpi.commerceCount).toBe(2)
    expect(kpi.avgGri).toBe(70)
    expect(kpi.recommendedCount).toBeGreaterThanOrEqual(0)
  })
})

describe('computeKpiDelta', () => {
  it('현재 vs 이전 분기 KPI delta를 계산한다', () => {
    const current = { totalVolume: 12000, avgGri: 65, commerceCount: 12, recommendedCount: 4 }
    const previous = { totalVolume: 10000, avgGri: 70, commerceCount: 10, recommendedCount: 3 }
    const result = computeKpiDelta(current, previous)
    expect(result.delta.totalVolume).toBe(2000)
    expect(result.delta.avgGri).toBe(-5)
    expect(result.delta.commerceCount).toBe(2)
    expect(result.delta.recommendedCount).toBe(1)
  })
})

describe('getPreviousQuarter', () => {
  const quarters = ['2024Q1', '2024Q2', '2024Q3', '2024Q4', '2025Q1']

  it('직전 분기를 반환한다', () => {
    expect(getPreviousQuarter('2024Q3', quarters)).toBe('2024Q2')
    expect(getPreviousQuarter('2025Q1', quarters)).toBe('2024Q4')
  })

  it('첫 분기 또는 미존재 분기는 null', () => {
    expect(getPreviousQuarter('2024Q1', quarters)).toBeNull()
    expect(getPreviousQuarter('2099Q1', quarters)).toBeNull()
  })
})

describe('formatDelta', () => {
  it('양수는 + 부호 포함', () => {
    expect(formatDelta(1234)).toBe('+1,234')
  })
  it('음수는 - 부호 그대로', () => {
    expect(formatDelta(-7.5)).toBe('-7.5')
  })
  it('0은 ±0', () => {
    expect(formatDelta(0)).toBe('±0')
  })
})

describe('deltaTone', () => {
  it('higher 기준: 양수=up, 음수=down', () => {
    expect(deltaTone(5)).toBe('up')
    expect(deltaTone(-5)).toBe('down')
    expect(deltaTone(0)).toBe('flat')
  })
  it('lower 기준: 양수=down, 음수=up (GRI 같은 위험도용)', () => {
    expect(deltaTone(5, 'lower')).toBe('down')
    expect(deltaTone(-5, 'lower')).toBe('up')
  })
})
