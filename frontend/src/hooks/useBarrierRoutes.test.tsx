/* @vitest-environment jsdom */
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useBarrierRoutes } from './useBarrierRoutes'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('useBarrierRoutes', () => {
  it('does not fetch while disabled', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useBarrierRoutes('2025Q4', false))

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current.routes).toEqual([])
    expect(result.current.isLoading).toBe(false)
  })

  it('falls back to mock routes when the API request fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          quarter: '2025Q4',
          total: 1,
          routes: [{
            barrierId: 'b1',
            sourceId: 'A',
            targetId: 'B',
            path: [[126.9, 37.4], [127.1, 37.6]],
            source: 'mock',
          }],
        }),
      })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useBarrierRoutes('2025Q4', true))

    await waitFor(() => {
      expect(result.current.routes).toHaveLength(1)
    })
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/barrier-routes?quarter=2025Q4'))
    expect(fetchMock).toHaveBeenCalledWith('/data/mock_barrier_routes.json')
  })
})
