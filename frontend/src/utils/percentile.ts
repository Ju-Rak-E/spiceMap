/**
 * 분포에서 target이 차지하는 "상위 몇 %" 위치를 산출.
 *
 * 정의: target 이상인 값의 비율 (위험 지표 — GRI·폐업률은 클수록 위험).
 * 빈 분포는 100을 반환. 결과는 1~100 범위로 clamp.
 */
export function computePercentile(values: number[], target: number): number {
  const valid = values.filter((v): v is number => v != null && Number.isFinite(v))
  if (valid.length === 0) return 100
  const countAboveOrEqual = valid.filter((v) => v >= target).length
  return Math.max(1, Math.round((countAboveOrEqual / valid.length) * 100))
}
