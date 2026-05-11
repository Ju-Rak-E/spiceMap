// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import PolicyCard from './PolicyCard'
import type { PolicyInsight } from '../hooks/usePolicyInsights'

function makeInsight(overrides: Partial<PolicyInsight> = {}): PolicyInsight {
  return {
    nodeId: 'gw_001',
    priority: '즉시개입',
    title: '현장 조사 + 금융 지원',
    rationale: '신림 골목상권 ? Q3→Q4 유입 -38%',
    source: 'Module D R4',
    ruleId: 'R4',
    ...overrides,
  }
}

describe('PolicyCard', () => {
  afterEach(() => cleanup())

  it('renders title, rationale, source, and response signal', () => {
    render(<PolicyCard insight={makeInsight()} />)
    expect(screen.getByText('현장 조사 + 금융 지원')).toBeTruthy()
    expect(screen.getByText(/신림 골목상권/)).toBeTruthy()
    expect(screen.getByText(/규칙: Module D R4/)).toBeTruthy()
    expect(screen.getByText('젠트리피케이션 예방')).toBeTruthy()
  })

  it('renders rule-based proposal disclaimer', () => {
    render(<PolicyCard insight={makeInsight()} />)
    expect(screen.getByText(/규칙 기반 제안 · 실제 시행 정책 아님/)).toBeTruthy()
    expect(screen.getByText(/창업 추천 결과와는 별개의 참고 정보/)).toBeTruthy()
  })

  it('uses regular testid when not highlighted', () => {
    render(<PolicyCard insight={makeInsight()} />)
    expect(screen.getByTestId('policy-card')).toBeTruthy()
    expect(screen.queryByTestId('policy-card-highlight')).toBeNull()
  })

  it('uses highlight testid when highlight=true (Hero shot R4)', () => {
    render(<PolicyCard insight={makeInsight()} highlight />)
    expect(screen.getByTestId('policy-card-highlight')).toBeTruthy()
    expect(screen.queryByTestId('policy-card')).toBeNull()
  })

  it('applies fadeIn animation only when highlighted', () => {
    const { container, rerender } = render(
      <PolicyCard insight={makeInsight()} />
    )
    const normal = container.firstChild as HTMLElement
    expect(normal.style.animation).toBe('')

    rerender(<PolicyCard insight={makeInsight()} highlight />)
    const highlighted = container.firstChild as HTMLElement
    expect(highlighted.style.animation).toMatch(/heroPolicyFadeIn 300ms/)
  })

  it('applies yellow outline when highlighted', () => {
    const { container } = render(<PolicyCard insight={makeInsight()} highlight />)
    const el = container.firstChild as HTMLElement
    expect(el.style.outline).toContain('#FFC107')
  })

  it('maps growth text to 성장 지원', () => {
    render(<PolicyCard insight={makeInsight({ priority: '연내지원', ruleId: 'R6', title: '성장 상권 지원 검토' })} />)
    expect(screen.getByText('성장 지원')).toBeTruthy()
  })

  it('maps empty monitoring to 지속 모니터링', () => {
    render(<PolicyCard insight={makeInsight({ priority: '모니터링', ruleId: 'R7', title: '정기 점검', rationale: '안정형' })} />)
    expect(screen.getByText('지속 모니터링')).toBeTruthy()
  })

  it('falls back for unknown priority', () => {
    render(
      <PolicyCard insight={makeInsight({ priority: '알수없음' as never, ruleId: undefined, title: '상태 점검', rationale: '관찰 필요' })} />
    )
    expect(screen.getByText('지속 모니터링')).toBeTruthy()
  })
})
