import { describe, it, expect } from 'vitest'
import { normalizeElevation, getMetricValue, easeOutCubic, interpolateProgress, formatMetricValue } from './threeDUtils'
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

describe('easeOutCubic', () => {
  it('t=0 → 0', () => {
    expect(easeOutCubic(0)).toBe(0)
  })
  it('t=1 → 1', () => {
    expect(easeOutCubic(1)).toBe(1)
  })
  it('t=0.5 → 0.875 (1 - 0.5^3)', () => {
    expect(easeOutCubic(0.5)).toBeCloseTo(0.875, 5)
  })
  it('범위 외 입력은 [0,1]로 클램프', () => {
    expect(easeOutCubic(-0.5)).toBe(0)
    expect(easeOutCubic(1.5)).toBe(1)
  })
})

describe('interpolateProgress', () => {
  it('elapsed=0 → start 값', () => {
    expect(interpolateProgress(0, 1, 0, 600)).toBe(0)
  })
  it('elapsed >= duration → target 값 (애니메이션 완료)', () => {
    expect(interpolateProgress(0, 1, 600, 600)).toBe(1)
    expect(interpolateProgress(0, 1, 1200, 600)).toBe(1)
  })
  it('현재 progress(0.4)에서 target(1)로 보간 시작 (재전환 점프 방지)', () => {
    expect(interpolateProgress(0.4, 1, 0, 600)).toBe(0.4)
  })
  it('1→0 역방향 애니메이션', () => {
    expect(interpolateProgress(1, 0, 0, 300)).toBe(1)
    expect(interpolateProgress(1, 0, 300, 300)).toBe(0)
  })
  it('duration=0 → 즉시 target 반환 (0 나눗셈 방지)', () => {
    expect(interpolateProgress(0, 1, 0, 0)).toBe(1)
  })
})

describe('formatMetricValue', () => {
  it('degreeCentrality keeps enough precision near 1.0', () => {
    expect(formatMetricValue(0.995, 'degreeCentrality')).toBe('0.995')
  })
})
