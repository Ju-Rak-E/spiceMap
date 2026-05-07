// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import ThreeDViewControl, { getMetricPictogramStats } from './ThreeDViewControl'
import type { CommerceNode } from '../types/commerce'

afterEach(cleanup)

const nodes: CommerceNode[] = [
  {
    id: 'gc_001',
    name: '강남역',
    coordinates: [127.02, 37.49],
    type: '흡수형_과열',
    district: '강남구',
    netFlow: 2000,
    degreeCentrality: 0.8,
    griScore: 80,
    closeRate: 10,
  },
  {
    id: 'gc_002',
    name: '역삼동',
    coordinates: [127.03, 37.5],
    type: '안정형',
    district: '강남구',
    netFlow: 50,
    degreeCentrality: 0.3,
    griScore: 30,
    closeRate: 2,
  },
]

describe('ThreeDViewControl', () => {
  const defaultProps = {
    mode: 'off' as const,
    metric: 'griScore' as const,
    nodes,
    onModeChange: vi.fn(),
    onMetricChange: vi.fn(),
  }

  it('OFF/폴리곤/이미지 버튼 렌더링', () => {
    render(<ThreeDViewControl {...defaultProps} />)
    expect(screen.getByText('OFF')).toBeTruthy()
    expect(screen.getByText('폴리곤')).toBeTruthy()
    expect(screen.getByText('이미지')).toBeTruthy()
  })

  it('mode=off 시 지표 드롭다운 미표시', () => {
    render(<ThreeDViewControl {...defaultProps} />)
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('폴리곤 버튼 클릭 → onModeChange("polygon") 호출', () => {
    const onModeChange = vi.fn()
    render(<ThreeDViewControl {...defaultProps} onModeChange={onModeChange} />)
    fireEvent.click(screen.getByText('폴리곤'))
    expect(onModeChange).toHaveBeenCalledWith('polygon')
  })

  it('mode=polygon 시 지표 드롭다운과 픽토그램 카드 표시', () => {
    render(<ThreeDViewControl {...defaultProps} mode="polygon" />)
    expect(screen.getByRole('combobox')).toBeTruthy()
    expect(screen.getByTestId('metric-pictogram-netFlow')).toBeTruthy()
  })

  it('지표 변경 → onMetricChange 호출', () => {
    const onMetricChange = vi.fn()
    render(<ThreeDViewControl {...defaultProps} mode="polygon" onMetricChange={onMetricChange} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'netFlow' } })
    expect(onMetricChange).toHaveBeenCalledWith('netFlow')
  })

  it('유입량이 클수록 사람 픽토그램이 커지고 많아진다', () => {
    const high = getMetricPictogramStats(nodes, 'netFlow')
    const low = getMetricPictogramStats([{ ...nodes[0], netFlow: 0 }], 'netFlow')
    expect(high.count).toBeGreaterThan(low.count)
    expect(high.size).toBeGreaterThan(low.size)
  })
})
