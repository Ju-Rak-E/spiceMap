// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { use3DView } from './use3DView'
import type { MutableRefObject } from 'react'
import type maplibregl from 'maplibre-gl'

const mockFlyTo = vi.fn()
const mockMap = { flyTo: mockFlyTo } as unknown as maplibregl.Map
const mapRef: MutableRefObject<maplibregl.Map | null> = { current: mockMap }

beforeEach(() => {
  mockFlyTo.mockClear()
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    json: () => Promise.resolve({ features: [] }),
  }))
})

describe('use3DView', () => {
  it('초기 상태: mode=off, metric=griScore', () => {
    const { result } = renderHook(() => use3DView(mapRef))
    expect(result.current.mode).toBe('off')
    expect(result.current.metric).toBe('griScore')
  })

  it('polygon으로 setMode → flyTo pitch 45 호출', () => {
    const { result } = renderHook(() => use3DView(mapRef))
    act(() => { result.current.setMode('polygon') })
    expect(result.current.mode).toBe('polygon')
    expect(mockFlyTo).toHaveBeenCalledWith({ pitch: 45, duration: 800 })
  })

  it('off로 setMode → flyTo pitch 0 호출', () => {
    const { result } = renderHook(() => use3DView(mapRef))
    act(() => { result.current.setMode('polygon') })
    act(() => { result.current.setMode('off') })
    expect(mockFlyTo).toHaveBeenLastCalledWith({ pitch: 0, bearing: 0, duration: 600 })
  })

  it('polygon → column 전환 시 flyTo pitch 45 재호출', () => {
    const { result } = renderHook(() => use3DView(mapRef))
    act(() => { result.current.setMode('polygon') })
    act(() => { result.current.setMode('column') })
    expect(mockFlyTo).toHaveBeenLastCalledWith({ pitch: 45, duration: 800 })
  })

  it('setMetric → metric 상태 변경', () => {
    const { result } = renderHook(() => use3DView(mapRef))
    act(() => { result.current.setMetric('netFlow') })
    expect(result.current.metric).toBe('netFlow')
  })
})
