import type { HeightMetric } from './threeDUtils'

export type RGB = [number, number, number]
export type RampStop = [number, RGB]

// 위험도: 안전 → 경고 → 위험
export const RAMP_RISK: RampStop[] = [
  [0.0, [70, 130, 180]],
  [0.5, [255, 167, 38]],
  [1.0, [239, 83, 80]],
]

// 순유입: 유출 → 중립 → 유입
export const RAMP_FLOW: RampStop[] = [
  [0.0, [69, 90, 120]],
  [0.5, [120, 160, 200]],
  [1.0, [123, 208, 141]],
]

// 폐업률: 안정 → 경계 → 위험
export const RAMP_CLOSE: RampStop[] = [
  [0.0, [123, 208, 141]],
  [0.5, [255, 213, 79]],
  [1.0, [255, 138, 101]],
]

// 연결 중심성: 어두운 다크블루 → 밝은 시안
export const RAMP_DEGREE: RampStop[] = [
  [0.0, [38, 70, 92]],
  [1.0, [100, 220, 240]],
]

function clamp01(t: number): number {
  return Math.max(0, Math.min(1, t))
}

export function rampColor(t: number, ramp: RampStop[]): RGB {
  const ct = clamp01(t)
  if (ct <= ramp[0][0]) return ramp[0][1]
  if (ct >= ramp[ramp.length - 1][0]) return ramp[ramp.length - 1][1]

  for (let i = 0; i < ramp.length - 1; i += 1) {
    const [t0, c0] = ramp[i]
    const [t1, c1] = ramp[i + 1]
    if (ct >= t0 && ct <= t1) {
      const localT = (ct - t0) / (t1 - t0)
      return [
        Math.round(c0[0] + (c1[0] - c0[0]) * localT),
        Math.round(c0[1] + (c1[1] - c0[1]) * localT),
        Math.round(c0[2] + (c1[2] - c0[2]) * localT),
      ]
    }
  }
  return ramp[ramp.length - 1][1]
}

export function getRampForMetric(metric: HeightMetric): RampStop[] {
  switch (metric) {
    case 'griScore': return RAMP_RISK
    case 'netFlow': return RAMP_FLOW
    case 'closeRate': return RAMP_CLOSE
    case 'degreeCentrality': return RAMP_DEGREE
  }
}
