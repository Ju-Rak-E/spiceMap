import { describe, it, expect } from 'vitest'
import { getControlPoint, CURVE_FACTOR } from './flowBezier'

function measureCurvature(src: [number, number], tgt: [number, number]): number {
  const ctrl = getControlPoint(src, tgt)
  const midX = (src[0] + tgt[0]) / 2
  const midY = (src[1] + tgt[1]) / 2
  return Math.sqrt((ctrl[0] - midX) ** 2 + (ctrl[1] - midY) ** 2)
}

describe('getControlPoint — 거리 비례 곡률', () => {
  const NEAR_SRC: [number, number] = [126.90, 37.50]
  const NEAR_TGT: [number, number] = [126.92, 37.51]  // dist ≈ 0.022°

  const FAR_SRC: [number, number] = [126.90, 37.50]
  const FAR_TGT: [number, number] = [127.40, 37.90]   // dist ≈ 0.54° → effectiveFactor = 0.45

  it('단거리 흐름의 곡률은 CURVE_FACTOR 기반 최대보다 작아야 한다', () => {
    const nearCurve = measureCurvature(NEAR_SRC, NEAR_TGT)
    const dx = NEAR_TGT[0] - NEAR_SRC[0]
    const dy = NEAR_TGT[1] - NEAR_SRC[1]
    const dist = Math.sqrt(dx * dx + dy * dy)
    const maxCurve = dist * CURVE_FACTOR
    expect(nearCurve).toBeLessThan(maxCurve)
  })

  it('원거리 흐름은 CURVE_FACTOR를 그대로 적용한다 (상한 도달)', () => {
    const farCurve = measureCurvature(FAR_SRC, FAR_TGT)
    const dx = FAR_TGT[0] - FAR_SRC[0]
    const dy = FAR_TGT[1] - FAR_SRC[1]
    const dist = Math.sqrt(dx * dx + dy * dy)
    const maxCurve = dist * CURVE_FACTOR
    expect(farCurve).toBeCloseTo(maxCurve, 4)
  })

  it('출발지와 도착지가 같으면 출발지를 반환한다', () => {
    const src: [number, number] = [126.9, 37.5]
    expect(getControlPoint(src, src)).toEqual(src)
  })
})
