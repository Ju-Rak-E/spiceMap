import { describe, it, expect } from 'vitest'
import { derivePriority, type PolicyPriority } from './usePolicyInsights'

describe('derivePriority', () => {
  it('GRI 80 이상이면 즉시개입', () => {
    expect(derivePriority(80)).toBe<PolicyPriority>('즉시개입')
    expect(derivePriority(88)).toBe<PolicyPriority>('즉시개입')
    expect(derivePriority(100)).toBe<PolicyPriority>('즉시개입')
  })

  it('GRI 60~79이면 연내지원', () => {
    expect(derivePriority(60)).toBe<PolicyPriority>('연내지원')
    expect(derivePriority(74)).toBe<PolicyPriority>('연내지원')
    expect(derivePriority(79)).toBe<PolicyPriority>('연내지원')
  })

  it('GRI 59 이하이면 모니터링', () => {
    expect(derivePriority(59)).toBe<PolicyPriority>('모니터링')
    expect(derivePriority(41)).toBe<PolicyPriority>('모니터링')
    expect(derivePriority(0)).toBe<PolicyPriority>('모니터링')
  })
})
