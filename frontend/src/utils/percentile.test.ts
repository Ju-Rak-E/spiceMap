import { describe, it, expect } from 'vitest'
import { computePercentile } from './percentile'

describe('computePercentile', () => {
  it('returns 100 for empty array (no distribution)', () => {
    expect(computePercentile([], 50)).toBe(100)
  })

  it('returns 100 when target is the smallest value (everyone is at-or-above)', () => {
    expect(computePercentile([10, 20, 30, 40, 50], 10)).toBe(100)
  })

  it('returns 20 when target is the max in 5-value distribution (1/5)', () => {
    expect(computePercentile([10, 20, 30, 40, 50], 50)).toBe(20)
  })

  it('returns 60 when 3 of 5 values are at-or-above target', () => {
    expect(computePercentile([10, 20, 30, 40, 50], 30)).toBe(60)
  })

  it('returns 100 when all values are tied to target', () => {
    expect(computePercentile([20, 20, 20], 20)).toBe(100)
  })

  it('filters null/undefined/NaN values from distribution', () => {
    const values = [10, null as unknown as number, 20, 30, NaN]
    // valid = [10, 20, 30], target=20 → 2/3 ≈ 67
    expect(computePercentile(values, 20)).toBe(67)
  })

  it('clamps to minimum 1% (never returns 0 for in-distribution targets)', () => {
    // target larger than every value → 0/n → clamped to 1
    expect(computePercentile([10, 20, 30], 100)).toBe(1)
  })

  it('handles single-value distribution', () => {
    expect(computePercentile([42], 42)).toBe(100)
  })

  it('produces realistic percentile for large distribution (1,650 commerces)', () => {
    // 시뮬레이션: 1,650 상권 GRI가 0~100 균등, target=78
    const values = Array.from({ length: 1650 }, (_, i) => (i / 1649) * 100)
    const result = computePercentile(values, 78)
    expect(result).toBeGreaterThan(15)
    expect(result).toBeLessThan(30)
  })
})
