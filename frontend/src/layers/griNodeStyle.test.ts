import { describe, it, expect } from 'vitest'
import { getGriBorderColor, getGriBorderWidth } from './CommerceNodeLayer'

describe('getGriBorderColor', () => {
  it('GRI 70 이상: 빨간 테두리를 반환한다', () => {
    const [r] = getGriBorderColor(70, false)
    expect(r).toBe(239)
  })
  it('GRI 40~69: 주황 테두리를 반환한다', () => {
    const [r, g] = getGriBorderColor(55, false)
    expect(r).toBe(255)
    expect(g).toBe(167)
  })
  it('GRI 39 이하: 흰색 계열 테두리를 반환한다', () => {
    const [r, g, b, a] = getGriBorderColor(30, false)
    expect(r).toBeGreaterThan(200)
    expect(g).toBeGreaterThan(200)
    expect(b).toBeGreaterThan(200)
    expect(a).toBe(80)
  })
  it('선택된 노드: GRI와 무관하게 흰색 테두리를 반환한다', () => {
    const [r, _g, _b, a] = getGriBorderColor(90, true)
    expect(r).toBeGreaterThan(200)
    expect(a).toBe(255)
  })
  it('GRI 정확히 39: 흰색 계열을 반환한다 (40 미만 경계)', () => {
    expect(getGriBorderColor(39, false)[0]).toBeGreaterThan(200)
    expect(getGriBorderWidth(39, false)).toBe(20)
  })
})

describe('getGriBorderWidth', () => {
  it('GRI 70 이상: 90m', () => { expect(getGriBorderWidth(70, false)).toBe(90) })
  it('GRI 40~69: 60m', () => { expect(getGriBorderWidth(55, false)).toBe(60) })
  it('GRI 39 이하: 20m', () => { expect(getGriBorderWidth(30, false)).toBe(20) })
  it('선택된 노드: GRI와 무관하게 90m', () => { expect(getGriBorderWidth(10, true)).toBe(90) })
})
