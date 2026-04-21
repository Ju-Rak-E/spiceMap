import { describe, it, expect } from 'vitest'
import { isDemoMode } from './demoMode'

describe('isDemoMode', () => {
  it('VITE_API_BASE_URL가 없으면 true를 반환한다', () => {
    // 테스트 환경에서는 VITE_API_BASE_URL이 없으므로 demo mode
    expect(isDemoMode()).toBe(true)
  })
})
