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
    insight: {
      nodeId: 'gc_001',
      priority: '즉시개입',
      title: '과열 상권 모니터링 강화',
      rationale: 'GRI 82, 흡수형_과열',
      source: 'Module D R5',
    },
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

  it('상권 위험도 점수가 표시된다', () => {
    renderPanel()
    expect(screen.getAllByText('82점').length).toBeGreaterThan(0)
  })

  it('상권 위험도 색상 스케일이 표시된다', () => {
    renderPanel()
    expect(screen.getByLabelText('상권 위험도 82점')).toBeTruthy()
    expect(screen.getByText('낮음')).toBeTruthy()
    expect(screen.getByText('주의')).toBeTruthy()
    expect(screen.getByText('위협')).toBeTruthy()
  })

  it('창업 적합도 라벨이 표시된다', () => {
    renderPanel()
    expect(screen.getAllByText('비추천').length).toBeGreaterThan(0)
  })

  it('순유입 값이 표시된다', () => {
    renderPanel()
    expect(screen.getAllByText('+1,200명').length).toBeGreaterThan(0)
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

  it('검토 업종이 창업 판단 요약 안에 표시된다', () => {
    renderPanel()
    expect(screen.getAllByText('검토 업종').length).toBeGreaterThan(0)
  })

  it('지역 대응 신호가 상세 패널 하단 보조 정보로 표시된다', () => {
    renderPanel()
    expect(screen.getByText('지역 대응 신호')).toBeTruthy()
    expect(screen.getByText(/실제 시행 중인 정책이 아니라/)).toBeTruthy()
    expect(screen.getByText(/창업 추천 결과와는 별개의 참고 정보입니다/)).toBeTruthy()
  })
})
