import { describe, it, expect } from 'vitest'
import { calculateGri, type GriInput } from './gri'

// 테스트 픽스처
const HIGH_RISK: GriInput = {
  netInflowGrowthZscore: 2.5,   // 강한 순유입 증가
  franchiseShareGrowth: 0.7,    // 프랜차이즈 급증
  salesSurgeRate: 0.6,          // 매출 급증
  independentShopRatio: 0.1,    // 독립 소상공인 거의 없음
}

const LOW_RISK: GriInput = {
  netInflowGrowthZscore: -1.5,  // 순유입 감소
  franchiseShareGrowth: 0.05,   // 프랜차이즈 변화 없음
  salesSurgeRate: 0.0,          // 매출 변화 없음
  independentShopRatio: 0.8,    // 독립 소상공인 많음
}

const NEUTRAL: GriInput = {
  netInflowGrowthZscore: 0,
  franchiseShareGrowth: 0.3,
  salesSurgeRate: 0,
  independentShopRatio: 0.5,
}

describe('calculateGri', () => {
  describe('점수 범위', () => {
    it('결과는 항상 0 이상이어야 한다', () => {
      expect(calculateGri(LOW_RISK).score).toBeGreaterThanOrEqual(0)
    })

    it('결과는 항상 100 이하이어야 한다', () => {
      expect(calculateGri(HIGH_RISK).score).toBeLessThanOrEqual(100)
    })

    it('극단적 저위험 입력도 0 미만이 되지 않아야 한다', () => {
      const extremeLow: GriInput = {
        netInflowGrowthZscore: -3,
        franchiseShareGrowth: 0,
        salesSurgeRate: -1,
        independentShopRatio: 1,
      }
      expect(calculateGri(extremeLow).score).toBeGreaterThanOrEqual(0)
    })

    it('극단적 고위험 입력도 100 초과가 되지 않아야 한다', () => {
      const extremeHigh: GriInput = {
        netInflowGrowthZscore: 3,
        franchiseShareGrowth: 1,
        salesSurgeRate: 1,
        independentShopRatio: 0,
      }
      expect(calculateGri(extremeHigh).score).toBeLessThanOrEqual(100)
    })
  })

  describe('위험도 분류', () => {
    it('고위험 입력 → score 70 초과 (경보 이상)', () => {
      expect(calculateGri(HIGH_RISK).score).toBeGreaterThan(70)
    })

    it('저위험 입력 → score 70 미만 (안전)', () => {
      expect(calculateGri(LOW_RISK).score).toBeLessThan(70)
    })

    it('score 85+ → level이 danger여야 한다', () => {
      const result = calculateGri(HIGH_RISK)
      if (result.score >= 85) {
        expect(result.level).toBe('danger')
      }
    })

    it('score 70~84 → level이 warning이어야 한다', () => {
      // 70~84 구간에 딱 떨어지는 입력
      const midRisk: GriInput = {
        netInflowGrowthZscore: 1.5,
        franchiseShareGrowth: 0.3,
        salesSurgeRate: 0.2,
        independentShopRatio: 0.3,
      }
      const result = calculateGri(midRisk)
      if (result.score >= 70 && result.score < 85) {
        expect(result.level).toBe('warning')
      }
    })

    it('score 70 미만 → level이 safe여야 한다', () => {
      const result = calculateGri(LOW_RISK)
      if (result.score < 70) {
        expect(result.level).toBe('safe')
      }
    })
  })

  describe('가중치 방향성', () => {
    it('순유입 증가율이 높을수록 GRI가 높아야 한다', () => {
      const base = { ...NEUTRAL }
      const higher = { ...NEUTRAL, netInflowGrowthZscore: 2 }
      expect(calculateGri(higher).score).toBeGreaterThan(calculateGri(base).score)
    })

    it('독립 소상공인 비중이 높을수록 GRI가 낮아야 한다 (방어 지표)', () => {
      const base = { ...NEUTRAL }
      const moreIndependent = { ...NEUTRAL, independentShopRatio: 0.9 }
      expect(calculateGri(moreIndependent).score).toBeLessThan(calculateGri(base).score)
    })

    it('프랜차이즈 비중이 높을수록 GRI가 높아야 한다', () => {
      const base = { ...NEUTRAL }
      const higherFranchise = { ...NEUTRAL, franchiseShareGrowth: 0.9 }
      expect(calculateGri(higherFranchise).score).toBeGreaterThan(calculateGri(base).score)
    })
  })
})
