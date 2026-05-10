// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import ThreeDViewControl from './ThreeDViewControl'
import { getMetricPictogramStats } from '../utils/metricPictogram'
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

  it('OFF/상권 3D 버튼 렌더링', () => {
    render(<ThreeDViewControl {...defaultProps} />)
    expect(screen.getByText('OFF')).toBeTruthy()
    expect(screen.getByText('상권 3D')).toBeTruthy()
    expect(screen.queryByText('자치구 3D')).toBeNull()
  })

  it('mode=off 시 지표 드롭다운 미표시', () => {
    render(<ThreeDViewControl {...defaultProps} />)
    expect(screen.queryByRole('combobox')).toBeNull()
  })

  it('상권 3D 버튼 클릭 → onModeChange("commerce")', () => {
    const onModeChange = vi.fn()
    render(<ThreeDViewControl {...defaultProps} onModeChange={onModeChange} />)
    fireEvent.click(screen.getByText('상권 3D'))
    expect(onModeChange).toHaveBeenCalledWith('commerce')
  })

  it('mode=commerce 시에도 지표 드롭다운 표시', () => {
    render(<ThreeDViewControl {...defaultProps} mode="commerce" />)
    expect(screen.getByRole('combobox')).toBeTruthy()
    expect(screen.getByTestId('metric-pictogram-netFlow')).toBeTruthy()
  })

  it('지표 변경 → onMetricChange 호출', () => {
    const onMetricChange = vi.fn()
    render(<ThreeDViewControl {...defaultProps} mode="commerce" onMetricChange={onMetricChange} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'netFlow' } })
    expect(onMetricChange).toHaveBeenCalledWith('netFlow')
  })

  it('유입량이 클수록 사람 픽토그램이 커지고 많아진다', () => {
    const high = getMetricPictogramStats(nodes, 'netFlow')
    const low = getMetricPictogramStats([{ ...nodes[0], netFlow: 0 }], 'netFlow')
    expect(high.count).toBeGreaterThan(low.count)
    expect(high.size).toBeGreaterThan(low.size)
  })

  it('카드 픽토그램 카운트는 1~3 범위로 제한된다', () => {
    const high = getMetricPictogramStats(nodes, 'netFlow')
    const low = getMetricPictogramStats(undefined, 'netFlow')
    expect(high.count).toBeLessThanOrEqual(3)
    expect(high.count).toBeGreaterThanOrEqual(1)
    expect(low.count).toBeGreaterThanOrEqual(1)
  })
})
