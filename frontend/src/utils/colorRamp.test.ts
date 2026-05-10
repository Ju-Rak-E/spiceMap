import { describe, it, expect } from 'vitest'
import { rampColor, getRampForMetric, RAMP_RISK, RAMP_FLOW, RAMP_CLOSE, RAMP_DEGREE } from './colorRamp'

describe('rampColor', () => {
  it('t=0이면 첫 stop 색상 반환', () => {
    expect(rampColor(0, RAMP_RISK)).toEqual(RAMP_RISK[0][1])
  })

  it('t=1이면 마지막 stop 색상 반환', () => {
    expect(rampColor(1, RAMP_RISK)).toEqual(RAMP_RISK[RAMP_RISK.length - 1][1])
  })

  it('t<0은 0으로 클램프', () => {
    expect(rampColor(-0.5, RAMP_RISK)).toEqual(RAMP_RISK[0][1])
  })

  it('t>1은 1로 클램프', () => {
    expect(rampColor(1.5, RAMP_RISK)).toEqual(RAMP_RISK[RAMP_RISK.length - 1][1])
  })

  it('중간 t는 인접 stop 사이 선형 보간', () => {
    // RAMP_RISK = [[0, blue], [0.5, amber], [1, red]]
    // t=0.25 → blue와 amber 중간
    const blue = RAMP_RISK[0][1]
    const amber = RAMP_RISK[1][1]
    const expected: [number, number, number] = [
      Math.round((blue[0] + amber[0]) / 2),
      Math.round((blue[1] + amber[1]) / 2),
      Math.round((blue[2] + amber[2]) / 2),
    ]
    expect(rampColor(0.25, RAMP_RISK)).toEqual(expected)
  })

  it('각 stop 위치에서 정확히 해당 색', () => {
    expect(rampColor(0.5, RAMP_RISK)).toEqual(RAMP_RISK[1][1])
  })

  it('2-stop 램프도 동작 (RAMP_DEGREE)', () => {
    expect(rampColor(0, RAMP_DEGREE)).toEqual(RAMP_DEGREE[0][1])
    expect(rampColor(1, RAMP_DEGREE)).toEqual(RAMP_DEGREE[RAMP_DEGREE.length - 1][1])
  })
})

describe('getRampForMetric', () => {
  it('griScore → RAMP_RISK', () => {
    expect(getRampForMetric('griScore')).toBe(RAMP_RISK)
  })

  it('netFlow → RAMP_FLOW', () => {
    expect(getRampForMetric('netFlow')).toBe(RAMP_FLOW)
  })

  it('closeRate → RAMP_CLOSE', () => {
    expect(getRampForMetric('closeRate')).toBe(RAMP_CLOSE)
  })

  it('degreeCentrality → RAMP_DEGREE', () => {
    expect(getRampForMetric('degreeCentrality')).toBe(RAMP_DEGREE)
  })
})
