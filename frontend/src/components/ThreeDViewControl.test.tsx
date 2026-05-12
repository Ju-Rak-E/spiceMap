// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import ThreeDViewControl from './ThreeDViewControl'
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
    expect(screen.getByTestId('metric-option-netFlow')).toBeTruthy()
  })

  it('지표 변경 → onMetricChange 호출', () => {
    const onMetricChange = vi.fn()
    render(<ThreeDViewControl {...defaultProps} mode="commerce" onMetricChange={onMetricChange} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'netFlow' } })
    expect(onMetricChange).toHaveBeenCalledWith('netFlow')
  })

  it('지표 버튼은 텍스트 라벨만 표시한다', () => {
    render(<ThreeDViewControl {...defaultProps} mode="commerce" />)
    expect(screen.getByRole('button', { name: '상권위험도' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '순유입인구' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '폐업률' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '연결중심성' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '!' })).toBeNull()
    expect(screen.queryByRole('button', { name: '사람' })).toBeNull()
    expect(screen.queryByRole('button', { name: '연결' })).toBeNull()
  })
})
