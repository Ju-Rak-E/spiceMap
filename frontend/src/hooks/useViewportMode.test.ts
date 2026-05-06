// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useViewportMode } from './useViewportMode'

function resizeTo(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  window.dispatchEvent(new Event('resize'))
}

describe('useViewportMode', () => {
  it('marks 1024px as tablet layout', () => {
    resizeTo(1024)
    const { result } = renderHook(() => useViewportMode())
    expect(result.current.isTablet).toBe(true)
    expect(result.current.isNarrow).toBe(false)
  })

  it('updates on resize', () => {
    resizeTo(1280)
    const { result } = renderHook(() => useViewportMode())
    expect(result.current.isTablet).toBe(false)

    act(() => resizeTo(800))

    expect(result.current.isTablet).toBe(true)
    expect(result.current.isNarrow).toBe(true)
  })
})
