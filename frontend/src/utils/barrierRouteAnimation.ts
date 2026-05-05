import { clamp } from './math'

export const DISRUPTION_T = 0.5
export const DISRUPTION_HALF_WIDTH = 0.15

/**
 * Builds a navigation-route-style polyline (4 waypoints).
 * Dominant axis is traversed first, creating an angular L-shape like GPS routes.
 */
export function buildNavRouteWaypoints(
  src: [number, number],
  tgt: [number, number],
): [number, number][] {
  const dx = tgt[0] - src[0]
  const dy = tgt[1] - src[1]

  if (Math.abs(dx) >= Math.abs(dy)) {
    // East/West dominant: travel horizontal-first, then vertical
    return [
      src,
      [src[0] + dx * 0.55, src[1] + dy * 0.2],
      [src[0] + dx * 0.85, src[1] + dy * 0.8],
      tgt,
    ]
  }
  // North/South dominant: travel vertical-first, then horizontal
  return [
    src,
    [src[0] + dx * 0.2, src[1] + dy * 0.55],
    [src[0] + dx * 0.8, src[1] + dy * 0.85],
    tgt,
  ]
}

export function polylineLength(points: [number, number][]): number {
  let total = 0
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0]
    const dy = points[i][1] - points[i - 1][1]
    total += Math.sqrt(dx * dx + dy * dy)
  }
  return total
}

/** Sample position along a polyline at normalized t ∈ [0, 1]. */
export function samplePolyline(
  points: [number, number][],
  t: number,
): [number, number] {
  if (points.length === 0) return [0, 0]
  if (points.length === 1) return points[0]
  if (t <= 0) return points[0]
  if (t >= 1) return points[points.length - 1]

  const totalLen = polylineLength(points)
  if (totalLen === 0) return points[0]

  let remaining = clamp(t, 0, 1) * totalLen

  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0]
    const dy = points[i][1] - points[i - 1][1]
    const segLen = Math.sqrt(dx * dx + dy * dy)
    if (remaining <= segLen) {
      const segT = segLen > 0 ? remaining / segLen : 0
      return [
        points[i - 1][0] + segT * dx,
        points[i - 1][1] + segT * dy,
      ]
    }
    remaining -= segLen
  }

  return points[points.length - 1]
}

/**
 * Alpha multiplier [0–1]: particles fade to 0 at the disruption midpoint (t = DISRUPTION_T).
 * Quadratic falloff so the fade-in/out feels abrupt near the break zone.
 */
export function disruptionAlpha(t: number): number {
  const d = Math.abs(t - DISRUPTION_T)
  if (d >= DISRUPTION_HALF_WIDTH) return 1
  const ratio = d / DISRUPTION_HALF_WIDTH
  return ratio * ratio
}

/**
 * Lateral scatter offset (degrees) applied at the disruption zone.
 * seed ∈ [0, 1) determines per-particle direction.
 * Returns [0, 0] outside the disruption zone.
 */
export function disruptionScatter(
  t: number,
  seed: number,
  maxScatterDeg: number,
): [number, number] {
  const d = Math.abs(t - DISRUPTION_T)
  if (d >= DISRUPTION_HALF_WIDTH) return [0, 0]
  const intensity = 1 - d / DISRUPTION_HALF_WIDTH
  const angle = seed * Math.PI * 2
  const magnitude = maxScatterDeg * intensity
  return [Math.cos(angle) * magnitude, Math.sin(angle) * magnitude]
}
