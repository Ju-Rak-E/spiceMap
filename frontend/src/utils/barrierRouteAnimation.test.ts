import { describe, it, expect } from 'vitest'
import {
  buildNavRouteWaypoints,
  polylineLength,
  samplePolyline,
  disruptionAlpha,
  disruptionScatter,
  DISRUPTION_T,
  DISRUPTION_HALF_WIDTH,
} from './barrierRouteAnimation'

describe('buildNavRouteWaypoints', () => {
  it('always returns 4 waypoints', () => {
    expect(buildNavRouteWaypoints([0, 0], [1, 0.5])).toHaveLength(4)
    expect(buildNavRouteWaypoints([0, 0], [0.3, 1])).toHaveLength(4)
  })

  it('starts at src and ends at tgt', () => {
    const src: [number, number] = [126.952, 37.477]
    const tgt: [number, number] = [127.036, 37.500]
    const wps = buildNavRouteWaypoints(src, tgt)
    expect(wps[0]).toEqual(src)
    expect(wps[wps.length - 1]).toEqual(tgt)
  })

  it('uses horizontal-dominant routing when |dx| >= |dy|', () => {
    // dx=1, dy=0.3 → horizontal dominant
    const wps = buildNavRouteWaypoints([0, 0], [1, 0.3])
    // First intermediate at 55% of dx
    expect(wps[1][0]).toBeCloseTo(0.55)
    expect(wps[1][1]).toBeCloseTo(0.06)
  })

  it('uses vertical-dominant routing when |dy| > |dx|', () => {
    // dx=0.3, dy=1 → vertical dominant
    const wps = buildNavRouteWaypoints([0, 0], [0.3, 1])
    // First intermediate at 55% of dy
    expect(wps[1][1]).toBeCloseTo(0.55)
    expect(wps[1][0]).toBeCloseTo(0.06)
  })

  it('handles same source and target without throwing', () => {
    expect(() => buildNavRouteWaypoints([127, 37], [127, 37])).not.toThrow()
  })
})

describe('polylineLength', () => {
  it('returns 0 for empty array', () => {
    expect(polylineLength([])).toBe(0)
  })

  it('returns 0 for single point', () => {
    expect(polylineLength([[0, 0]])).toBe(0)
  })

  it('returns correct length for 2-point line (3-4-5 triangle)', () => {
    expect(polylineLength([[0, 0], [3, 4]])).toBeCloseTo(5)
  })

  it('sums segment lengths for L-shaped path', () => {
    // [0,0] → [1,0] → [1,1]: len = 1 + 1 = 2
    const pts: [number, number][] = [[0, 0], [1, 0], [1, 1]]
    expect(polylineLength(pts)).toBeCloseTo(2)
  })
})

describe('samplePolyline', () => {
  it('returns [0,0] for empty array', () => {
    expect(samplePolyline([], 0.5)).toEqual([0, 0])
  })

  it('returns the sole point for single-element array', () => {
    expect(samplePolyline([[5, 5]], 0.5)).toEqual([5, 5])
  })

  it('returns first point at t=0', () => {
    expect(samplePolyline([[0, 0], [2, 0]], 0)).toEqual([0, 0])
  })

  it('returns last point at t=1', () => {
    expect(samplePolyline([[0, 0], [2, 0]], 1)).toEqual([2, 0])
  })

  it('returns midpoint at t=0.5 for a straight 2-point path', () => {
    const result = samplePolyline([[0, 0], [2, 0]], 0.5)
    expect(result[0]).toBeCloseTo(1)
    expect(result[1]).toBeCloseTo(0)
  })

  it('correctly crosses segment boundaries', () => {
    // [0,0] → [1,0] → [2,0]: equal segments, mid at t=0.5 → [1,0]
    const pts: [number, number][] = [[0, 0], [1, 0], [2, 0]]
    const mid = samplePolyline(pts, 0.5)
    expect(mid[0]).toBeCloseTo(1)
    expect(mid[1]).toBeCloseTo(0)
  })

  it('handles t < 0 as t=0', () => {
    const result = samplePolyline([[0, 0], [1, 0]], -0.5)
    expect(result).toEqual([0, 0])
  })

  it('handles t > 1 as t=1', () => {
    const result = samplePolyline([[0, 0], [1, 0]], 1.5)
    expect(result).toEqual([1, 0])
  })
})

describe('disruptionAlpha', () => {
  it('returns 1 far outside the disruption zone', () => {
    expect(disruptionAlpha(0)).toBe(1)
    expect(disruptionAlpha(1)).toBe(1)
    expect(disruptionAlpha(DISRUPTION_T - DISRUPTION_HALF_WIDTH - 0.01)).toBe(1)
    expect(disruptionAlpha(DISRUPTION_T + DISRUPTION_HALF_WIDTH + 0.01)).toBe(1)
  })

  it('returns exactly 0 at the disruption center', () => {
    expect(disruptionAlpha(DISRUPTION_T)).toBe(0)
  })

  it('returns value in (0, 1) inside the disruption zone', () => {
    const alpha = disruptionAlpha(DISRUPTION_T + DISRUPTION_HALF_WIDTH * 0.5)
    expect(alpha).toBeGreaterThan(0)
    expect(alpha).toBeLessThan(1)
  })

  it('is monotonically increasing away from disruption center', () => {
    const a1 = disruptionAlpha(DISRUPTION_T + 0.02)
    const a2 = disruptionAlpha(DISRUPTION_T + 0.05)
    const a3 = disruptionAlpha(DISRUPTION_T + 0.10)
    expect(a1).toBeLessThan(a2)
    expect(a2).toBeLessThan(a3)
  })

  it('is symmetric around DISRUPTION_T', () => {
    const left = disruptionAlpha(DISRUPTION_T - 0.05)
    const right = disruptionAlpha(DISRUPTION_T + 0.05)
    expect(left).toBeCloseTo(right)
  })
})

describe('disruptionScatter', () => {
  it('returns [0, 0] outside the disruption zone', () => {
    expect(disruptionScatter(0, 0.5, 0.005)).toEqual([0, 0])
    expect(disruptionScatter(1, 0.5, 0.005)).toEqual([0, 0])
    expect(disruptionScatter(DISRUPTION_T + DISRUPTION_HALF_WIDTH + 0.01, 0.5, 0.005)).toEqual([0, 0])
  })

  it('returns non-zero offset at disruption center', () => {
    const [sx, sy] = disruptionScatter(DISRUPTION_T, 0.25, 0.005)
    expect(Math.abs(sx) + Math.abs(sy)).toBeGreaterThan(0)
  })

  it('scatter magnitude is maximum at disruption center', () => {
    const atCenter = disruptionScatter(DISRUPTION_T, 0.5, 0.005)
    const nearEdge = disruptionScatter(DISRUPTION_T + DISRUPTION_HALF_WIDTH * 0.8, 0.5, 0.005)
    const magCenter = Math.hypot(atCenter[0], atCenter[1])
    const magEdge = Math.hypot(nearEdge[0], nearEdge[1])
    expect(magCenter).toBeGreaterThan(magEdge)
  })

  it('scatter direction varies with seed', () => {
    const r1 = disruptionScatter(DISRUPTION_T, 0, 0.005)
    const r2 = disruptionScatter(DISRUPTION_T, 0.5, 0.005)
    expect(r1).not.toEqual(r2)
  })

  it('scatter magnitude scales with maxScatterDeg', () => {
    const small = disruptionScatter(DISRUPTION_T, 0.3, 0.001)
    const large = disruptionScatter(DISRUPTION_T, 0.3, 0.010)
    const magSmall = Math.hypot(small[0], small[1])
    const magLarge = Math.hypot(large[0], large[1])
    expect(magLarge).toBeGreaterThan(magSmall)
  })
})
