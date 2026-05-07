// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

afterEach(cleanup)
import ThreeDViewControl from './ThreeDViewControl'

describe('ThreeDViewControl', () => {
  const defaultProps = {
    mode: 'off' as const,
    metric: 'griScore' as const,
    onModeChange: vi.fn(),
    onMetricChange: vi.fn(),
  }

  it('OFF/폴리곤/기둥 버튼 렌더링', () => {
    render(<ThreeDViewControl {...defaultProps} />)
    expect(screen.getByText('OFF')).toBeTruthy()
    expect(screen.getByText('폴리곤')).toBeTruthy()
    expect(screen.getByText('기둥')).toBeTruthy()
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

  it('mode=polygon 시 지표 드롭다운 표시', () => {
    render(<ThreeDViewControl {...defaultProps} mode="polygon" />)
    expect(screen.getByRole('combobox')).toBeTruthy()
  })

  it('지표 변경 → onMetricChange 호출', () => {
    const onMetricChange = vi.fn()
    render(<ThreeDViewControl {...defaultProps} mode="polygon" onMetricChange={onMetricChange} />)
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'netFlow' } })
    expect(onMetricChange).toHaveBeenCalledWith('netFlow')
  })
})
