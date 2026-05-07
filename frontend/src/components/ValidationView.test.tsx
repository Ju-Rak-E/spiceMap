// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import ValidationView from './ValidationView'

describe('ValidationView', () => {
  afterEach(() => cleanup())

  it('renders header with quarter and 5-card subtitle', () => {
    render(<ValidationView onClose={() => {}} />)
    expect(screen.getByText('검증 보고')).toBeTruthy()
    // 부제: 가설 H1·H2·H3 + 베이스라인 B1·B3
    const subtitle = screen.getByText(/H1·H2·H3 \+ 베이스라인 B1·B3/)
    expect(subtitle).toBeTruthy()
  })

  it('renders 5 cards with H1, H2, H3, B1, B3 ids', () => {
    render(<ValidationView onClose={() => {}} />)
    for (const id of ['H1', 'H2', 'H3', 'B1', 'B3']) {
      expect(screen.getByTestId(`validation-card-${id}`)).toBeTruthy()
    }
  })

  it('shows H1 result with r value', () => {
    render(<ValidationView onClose={() => {}} />)
    const h1 = screen.getByTestId('validation-card-H1')
    expect(h1.textContent).toContain('r = 0.106')
  })

  it('shows H2 real measurement result (D-5 실측: r=-0.595, n=39, 방향 반대)', () => {
    render(<ValidationView onClose={() => {}} />)
    const h2 = screen.getByTestId('validation-card-H2')
    // D-5 (2026-05-07) Supabase 실측: r=-0.595, n=39, p ≈ 6.3e-5, 방향 반대
    expect(h2.textContent).toContain('r = -0.595')
    expect(h2.textContent).toMatch(/n = 39/)
    expect(h2.textContent).toMatch(/방향 반대|음의 상관/)
  })

  it('shows B1 Jaccard 0.58 PASS', () => {
    render(<ValidationView onClose={() => {}} />)
    const b1 = screen.getByTestId('validation-card-B1')
    expect(b1.textContent).toContain('Jaccard')
    expect(b1.textContent).toContain('0.58')
  })

  it('shows B3 Jaccard 0.151 differentiation', () => {
    render(<ValidationView onClose={() => {}} />)
    const b3 = screen.getByTestId('validation-card-B3')
    expect(b3.textContent).toContain('Jaccard')
    expect(b3.textContent).toContain('0.151')
  })

  it('calls onClose when 닫기 버튼 click', () => {
    const onClose = vi.fn()
    render(<ValidationView onClose={onClose} />)
    const button = screen.getByText('← 지도로 돌아가기')
    fireEvent.click(button)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders source path in each card', () => {
    render(<ValidationView onClose={() => {}} />)
    for (const id of ['H1', 'H2', 'H3', 'B1', 'B3']) {
      const card = screen.getByTestId(`validation-card-${id}`)
      // 출처: ... 문구가 카드 하단에 존재
      expect(card.textContent).toMatch(/출처/)
    }
  })
})
