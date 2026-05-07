import { describe, it, expect } from 'vitest'
import { normalizeElevation, getMetricValue } from './threeDUtils'
import type { CommerceNode } from '../types/commerce'

const baseNode: CommerceNode = {
  id: 'test',
  name: '테스트 상권',
  coordinates: [127.0, 37.5],
  type: '안정형',
  district: '강남구',
  netFlow: 100,
  degreeCentrality: 0.5,
  griScore: 60,
  closeRate: 5,
}

describe('normalizeElevation', () => {
  it('0~maxHeight 범위로 정규화한다', () => {
    expect(normalizeElevation(50, 0, 100, 500)).toBe(250)
  })
  it('min === max 이면 maxHeight * 0.5 반환', () => {
    expect(normalizeElevation(50, 50, 50, 500)).toBe(250)
  })
  it('음수 결과는 0으로 클램프', () => {
    expect(normalizeElevation(-10, 0, 100, 500)).toBe(0)
  })
})

describe('getMetricValue', () => {
  it('griScore 반환', () => {
    expect(getMetricValue(baseNode, 'griScore')).toBe(60)
  })
  it('netFlow 반환', () => {
    expect(getMetricValue(baseNode, 'netFlow')).toBe(100)
  })
  it('closeRate undefined → 0', () => {
    expect(getMetricValue({ ...baseNode, closeRate: undefined }, 'closeRate')).toBe(0)
  })
  it('degreeCentrality 반환', () => {
    expect(getMetricValue(baseNode, 'degreeCentrality')).toBe(0.5)
  })
})
