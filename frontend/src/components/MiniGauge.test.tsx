// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import MiniGauge from './MiniGauge'

afterEach(() => cleanup())

describe('MiniGauge', () => {
  it('renders the label text', () => {
    render(<MiniGauge percentile={12} accent="#EF5350" label="상위 12%" />)
    expect(screen.getByText('상위 12%')).toBeTruthy()
  })

  it('fills the bar to the given percentile width', () => {
    render(<MiniGauge percentile={50} accent="#FFC107" label="상위 50%" />)
    const fill = screen.getByTestId('mini-gauge-fill')
    expect(fill.style.width).toBe('50%')
  })

  it('clamps percentile to 1..100 range (overflow values become 100%)', () => {
    render(<MiniGauge percentile={150} accent="#43A047" label="상위 100%" />)
    const fill = screen.getByTestId('mini-gauge-fill')
    expect(fill.style.width).toBe('100%')
  })

  it('clamps percentile to minimum 1% when given a value below 1', () => {
    render(<MiniGauge percentile={0} accent="#EF5350" label="상위 1% 이내" />)
    const fill = screen.getByTestId('mini-gauge-fill')
    expect(fill.style.width).toBe('1%')
  })

  it('applies the accent color to the fill', () => {
    render(<MiniGauge percentile={20} accent="#EF5350" label="상위 20%" />)
    const fill = screen.getByTestId('mini-gauge-fill')
    expect(fill.style.background).toContain('rgb(239, 83, 80)')
  })
})
