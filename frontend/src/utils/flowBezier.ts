import type { FlowPurpose } from '../hooks/useFlowData'

export const CURVE_FACTOR = 0.45

// 흐름 경로에 수직(시계방향)으로 오프셋된 베지어 제어점
export function getControlPoint(
  src: [number, number],
  tgt: [number, number],
  factor = CURVE_FACTOR,
): [number, number] {
  const dx = tgt[0] - src[0]
  const dy = tgt[1] - src[1]
  const dist = Math.sqrt(dx * dx + dy * dy)
  if (dist === 0) return src
  const effectiveFactor = Math.min(factor, 0.15 + dist * 0.6)  // 단거리일수록 곡률 감소
  // 수직 방향 (시계방향 90° 회전)
  const perpX = dy / dist
  const perpY = -dx / dist
  return [
    (src[0] + tgt[0]) / 2 + perpX * dist * effectiveFactor,
    (src[1] + tgt[1]) / 2 + perpY * dist * effectiveFactor,
  ]
}

export function quadBezier(
  src: [number, number],
  ctrl: [number, number],
  tgt: [number, number],
  t: number,
): [number, number] {
  const u = 1 - t
  return [
    u * u * src[0] + 2 * u * t * ctrl[0] + t * t * tgt[0],
    u * u * src[1] + 2 * u * t * ctrl[1] + t * t * tgt[1],
  ]
}

// 이동목적별 RGBA (선·파티클 공용)
export const PURPOSE_COLORS: Record<FlowPurpose, [number, number, number]> = {
  출근: [41, 182, 246],    // sky-blue
  쇼핑: [255, 167, 38],    // amber
  여가: [171, 71, 188],    // purple
  귀가: [102, 187, 106],   // green
}
