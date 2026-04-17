/**
 * GRI (Gentrification Risk Index / 젠트리피케이션 위험 지수)
 *
 * 공식 출처: FR_Role_Workflow.md § F-05
 * GRI v1.0 (임대료 데이터 미확보 → 4항목 가중치 재분배):
 *   0.40 × 순유입 증가율 (자치구 내 z-score)     [기존 0.30 / 0.75]
 * + 0.267 × 프랜차이즈 비중 증가 (0 ~ 1)          [기존 0.20 / 0.75]
 * + 0.20 × 매출 급증률 (분기 변화율, -1 ~ +1)     [기존 0.15 / 0.75]
 * - 0.133 × 독립 소상공인 비중 (0 ~ 1)             [기존 -0.10 / 0.75]
 *
 * 결과: 0~100 정규화 / 70+ 경보 / 85+ 위험
 * 변경 근거: week2_decisions.md Section 2 — 임대료 데이터 미확보로 4항목 재분배 (총합 1.0 유지 원칙)
 */

export interface GriInput {
  netInflowGrowthZscore: number   // 순유입 증가율 자치구 내 z-score (일반적으로 -3 ~ +3)
  franchiseShareGrowth: number    // 프랜차이즈 비중 증가 (0 ~ 1)
  salesSurgeRate: number          // 매출 급증률 분기 변화율 (-1 ~ +1)
  independentShopRatio: number    // 독립 소상공인 비중 (0 ~ 1, 방어 지표)
}

export interface GriResult {
  score: number                        // 0~100 (소수점 첫째 자리)
  level: 'safe' | 'warning' | 'danger' // 70 미만 / 70~84 / 85+
}

// GRI v1.0 가중치 (임대료 제외, 4항목 재분배: old / 0.75)
const WEIGHTS = {
  NET_INFLOW:      0.40,
  FRANCHISE_SHARE: 0.267,
  SALES_SURGE:     0.20,
  INDEPENDENT:    -0.133,  // 방어 지표: 높을수록 GRI 감소
} as const

// 가중합 원점수 정규화 기준 범위 [-2, +2] → [0, 100]
const RAW_RANGE = { MIN: -2, MAX: 2 } as const

// 위험 등급 임계값 (FR_Role_Workflow.md § F-05)
const THRESHOLDS = { WARNING: 70, DANGER: 85 } as const

function computeRawScore(input: GriInput): number {
  return (
    WEIGHTS.NET_INFLOW      * input.netInflowGrowthZscore +
    WEIGHTS.FRANCHISE_SHARE * input.franchiseShareGrowth  +
    WEIGHTS.SALES_SURGE     * input.salesSurgeRate        +
    WEIGHTS.INDEPENDENT     * input.independentShopRatio
  )
}

function normalizeToScore(raw: number): number {
  const ratio = (raw - RAW_RANGE.MIN) / (RAW_RANGE.MAX - RAW_RANGE.MIN)
  const clamped = Math.min(1, Math.max(0, ratio))
  return Math.round(clamped * 1000) / 10  // 소수점 첫째 자리
}

function classifyLevel(score: number): GriResult['level'] {
  if (score >= THRESHOLDS.DANGER)  return 'danger'
  if (score >= THRESHOLDS.WARNING) return 'warning'
  return 'safe'
}

export function calculateGri(input: GriInput): GriResult {
  const raw   = computeRawScore(input)
  const score = normalizeToScore(raw)
  return { score, level: classifyLevel(score) }
}
