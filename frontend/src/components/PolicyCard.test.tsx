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
    rationale: '신림 골목상권 — Q3→Q4 유입 -38%',
    source: 'Module D R4',
    ruleId: 'R4',
    ...overrides,
  }
}

describe('PolicyCard', () => {
  afterEach(() => cleanup())

  it('renders title, rationale, source, priority', () => {
    render(<PolicyCard insight={makeInsight()} />)
    expect(screen.getByText('현장 조사 + 금융 지원')).toBeTruthy()
    expect(screen.getByText(/신림 골목상권/)).toBeTruthy()
    expect(screen.getByText(/출처: Module D R4/)).toBeTruthy()
    expect(screen.getByText('즉시개입')).toBeTruthy()
  })

  it('renders rule_based label (FR-07)', () => {
    render(<PolicyCard insight={makeInsight()} />)
    expect(screen.getByText(/규칙 기반 \| AI 미사용/)).toBeTruthy()
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
    // outline 색상: #FFC107
    expect(el.style.outline).toContain('#FFC107')
  })

  it('uses 즉시개입 icon 🚨', () => {
    render(<PolicyCard insight={makeInsight({ priority: '즉시개입' })} />)
    expect(screen.getByText('🚨')).toBeTruthy()
  })

  it('uses 연내지원 icon 📋', () => {
    render(<PolicyCard insight={makeInsight({ priority: '연내지원' })} />)
    expect(screen.getByText('📋')).toBeTruthy()
  })

  it('uses 모니터링 icon 👁', () => {
    render(<PolicyCard insight={makeInsight({ priority: '모니터링' })} />)
    expect(screen.getByText('👁')).toBeTruthy()
  })

  it('falls back to default icon for unknown priority', () => {
    render(
      <PolicyCard insight={makeInsight({ priority: '알수없음' as never })} />
    )
    expect(screen.getByText('📌')).toBeTruthy()
  })
})
