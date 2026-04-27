// @vitest-environment jsdom
import { afterEach, describe, it, expect, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import CommerceDetailPanel from './CommerceDetailPanel'
import type { CommerceNode } from '../types/commerce'

const SAMPLE_NODE: CommerceNode = {
  id: 'gc_001',
  name: '역삼 먹자골목',
  coordinates: [127.036, 37.501],
  type: '흡수형_과열',
  netFlow: 1200,
  degreeCentrality: 0.85,
  griScore: 82,
  district: '강남구',
}

vi.mock('../hooks/useGriHistory', () => ({
  useGriHistory: () => ({
    series: [
      { ts: '2025-01', gri: 55 },
      { ts: '2025-02', gri: 70 },
      { ts: '2025-03', gri: 82 },
    ],
    isLoading: false,
    error: null,
  }),
}))

vi.mock('../hooks/usePolicyInsights', () => ({
  usePolicyInsights: () => ({
    insights: [],
    insight: null,
    isLoading: false,
    error: null,
  }),
}))

afterEach(() => {
  cleanup()
})

function renderPanel(onClose = () => {}) {
  return render(<CommerceDetailPanel node={SAMPLE_NODE} quarter="2025Q4" onClose={onClose} />)
}

describe('CommerceDetailPanel', () => {
  it('상권명이 표시된다', () => {
    renderPanel()
    expect(screen.getByText('역삼 먹자골목')).toBeTruthy()
  })

  it('GRI 점수가 표시된다', () => {
    renderPanel()
    expect(screen.getAllByText('82').length).toBeGreaterThan(0)
  })

  it('상권 유형 라벨이 표시된다', () => {
    renderPanel()
    expect(screen.getAllByText('흡수형_과열').length).toBeGreaterThan(0)
  })

  it('순유입 값이 표시된다', () => {
    renderPanel()
    expect(screen.getAllByText('+1200').length).toBeGreaterThan(0)
  })

  it('닫기 버튼 클릭 시 onClose가 호출된다', async () => {
    const onClose = vi.fn()
    renderPanel(onClose)
    await userEvent.click(screen.getByRole('button', { name: /패널 닫기/i }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('GRI 추세 그래프 SVG가 렌더된다', () => {
    renderPanel()
    expect(document.querySelector('svg')).toBeTruthy()
  })

  it('정책 카드가 없으면 빈 상태를 표시한다', () => {
    renderPanel()
    expect(screen.getAllByText('발동된 정책 없음').length).toBeGreaterThan(0)
  })
})
