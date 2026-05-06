// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { computeHeroPulseFrame, createHeroPulseLayer } from './CommerceNodeLayer'

const PERIOD_MS = 1500
const BASE_RADIUS = 14
const MAX_RADIUS = 34
const MAX_ALPHA = 0.7 * 255 // 178.5

describe('computeHeroPulseFrame', () => {
  it('phase 0 at elapsed 0 (cycle start)', () => {
    const f = computeHeroPulseFrame(0)
    expect(f.phase).toBe(0)
    expect(f.radius).toBe(BASE_RADIUS)
    expect(f.alpha).toBeCloseTo(MAX_ALPHA, 5)
  })

  it('phase 0.5 at elapsed 750 (mid cycle)', () => {
    const f = computeHeroPulseFrame(PERIOD_MS / 2)
    expect(f.phase).toBeCloseTo(0.5, 5)
    expect(f.radius).toBeCloseTo((BASE_RADIUS + MAX_RADIUS) / 2, 5)
    expect(f.alpha).toBeCloseTo(MAX_ALPHA / 2, 5)
  })

  it('wraps cleanly at full cycle (elapsed=1500 → phase=0)', () => {
    const f = computeHeroPulseFrame(PERIOD_MS)
    expect(f.phase).toBe(0)
    expect(f.radius).toBe(BASE_RADIUS)
  })

  it('continues across multiple cycles (elapsed=2250 → phase=0.5)', () => {
    const f = computeHeroPulseFrame(PERIOD_MS + PERIOD_MS / 2)
    expect(f.phase).toBeCloseTo(0.5, 5)
  })

  it('alpha decays from MAX to 0 as phase grows', () => {
    const start = computeHeroPulseFrame(0)
    const near_end = computeHeroPulseFrame(PERIOD_MS - 1)
    expect(near_end.alpha).toBeLessThan(start.alpha)
    // 끝에 가까울수록 alpha → 0
    expect(near_end.alpha).toBeLessThan(1)
  })

  it('radius grows from BASE to MAX as phase grows', () => {
    const start = computeHeroPulseFrame(0)
    const near_end = computeHeroPulseFrame(PERIOD_MS - 1)
    expect(near_end.radius).toBeGreaterThan(start.radius)
    expect(near_end.radius).toBeLessThanOrEqual(MAX_RADIUS)
  })
})

describe('createHeroPulseLayer', () => {
  it('returns null when target is null (safe no-op for non-hero mode)', () => {
    expect(createHeroPulseLayer(null)).toBeNull()
  })
})
