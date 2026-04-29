import { afterEach, describe, it, expect, vi } from 'vitest'
import { isDemoMode } from './demoMode'

describe('isDemoMode', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('VITE_DEMO_MODE=true이면 true를 반환한다', () => {
    vi.stubEnv('VITE_DEMO_MODE', 'true')
    expect(isDemoMode()).toBe(true)
  })

  it('VITE_DEMO_MODE가 없으면 false를 반환한다', () => {
    vi.stubEnv('VITE_DEMO_MODE', '')
    expect(isDemoMode()).toBe(false)
  })

  it('VITE_API_BASE_URL만 없어도 데모 모드로 전환하지 않는다', () => {
    vi.stubEnv('VITE_API_BASE_URL', '')
    expect(isDemoMode()).toBe(false)
  })
})
