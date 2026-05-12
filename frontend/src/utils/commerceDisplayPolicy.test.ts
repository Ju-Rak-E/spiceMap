import { describe, expect, it } from 'vitest'
import { resolveCommerceDisplayPolicy } from './commerceDisplayPolicy'

const TOTAL_DISTRICTS = 25

describe('resolveCommerceDisplayPolicy', () => {
  it('keeps district clusters for Seoul-wide scope at dong zoom', () => {
    const policy = resolveCommerceDisplayPolicy({
      zoomStage: 'dong',
      selectedDistrictCount: TOTAL_DISTRICTS,
      totalDistrictCount: TOTAL_DISTRICTS,
    })

    expect(policy.isSeoulWideScope).toBe(true)
    expect(policy.clusterLevel).toBe('district')
    expect(policy.statusLabel).toBe('서울 전체는 구 단위 요약 표시 중')
  })

  it('shows viewport-scoped commerce nodes for Seoul-wide scope at candidate zoom', () => {
    const policy = resolveCommerceDisplayPolicy({
      zoomStage: 'candidate',
      selectedDistrictCount: TOTAL_DISTRICTS,
      totalDistrictCount: TOTAL_DISTRICTS,
    })

    expect(policy.showCommerceNodes).toBe(true)
    expect(policy.nodeScope).toBe('viewport')
    expect(policy.clusterLevel).toBe('none')
    expect(policy.statusLabel).toBe('현재 화면 상권만 표시 중')
  })

  it('shows dong clusters for a focused district scope at dong zoom', () => {
    const policy = resolveCommerceDisplayPolicy({
      zoomStage: 'dong',
      selectedDistrictCount: 1,
      totalDistrictCount: TOTAL_DISTRICTS,
    })

    expect(policy.isFocusedScope).toBe(true)
    expect(policy.clusterLevel).toBe('dong')
  })

  it('shows commerce nodes for a focused district scope at candidate zoom', () => {
    const policy = resolveCommerceDisplayPolicy({
      zoomStage: 'candidate',
      selectedDistrictCount: 1,
      totalDistrictCount: TOTAL_DISTRICTS,
    })

    expect(policy.showCommerceNodes).toBe(true)
    expect(policy.nodeScope).toBe('viewport')
    expect(policy.clusterLevel).toBe('none')
  })

  it('keeps selected commerce focus visible in a Seoul-wide scope', () => {
    const policy = resolveCommerceDisplayPolicy({
      zoomStage: 'candidate',
      selectedDistrictCount: TOTAL_DISTRICTS,
      totalDistrictCount: TOTAL_DISTRICTS,
      hasSelectedNode: true,
    })

    expect(policy.showCommerceNodes).toBe(true)
    expect(policy.clusterLevel).toBe('none')
    expect(policy.statusLabel).toBe('선택 상권 중심 표시')
  })
})
