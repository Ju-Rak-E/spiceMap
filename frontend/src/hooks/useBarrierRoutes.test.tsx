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
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('min_score=0.45'))
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('limit=8'))
    expect(fetchMock).toHaveBeenCalledWith('/data/mock_barrier_routes.json')
  })

  it('uses the normalized API response when fetch succeeds', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        quarter: '2025Q4',
        total: 1,
        routes: [{
          barrierId: 'b1',
          sourceId: 'A',
          targetId: 'B',
          path: [[126.9, 37.4], [127.1, 37.6]],
          source: 'ors',
        }],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useBarrierRoutes('2025Q4', true))

    await waitFor(() => {
      expect(result.current.routes).toHaveLength(1)
    })
    expect(result.current.routes[0].source).toBe('ors')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/barrier-routes?quarter=2025Q4'))
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('min_score=0.45'))
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('limit=8'))
  })

  it('requests selected commerce routes with a higher limit', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ quarter: '2025Q4', total: 0, routes: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => useBarrierRoutes('2025Q4', true, '3110183'))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('comm_cd=3110183'))
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('limit=20'))
  })

  it('refetches when quarter changes', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ quarter: 'q', total: 0, routes: [] }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { rerender } = renderHook(
      ({ q }: { q: string }) => useBarrierRoutes(q, true),
      { initialProps: { q: '2025Q4' } },
    )
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))

    rerender({ q: '2025Q3' })
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining('quarter=2025Q3'))
  })

  it('drops routes whose path is shorter than two points', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        quarter: '2025Q4',
        total: 2,
        routes: [
          { barrierId: 'b1', sourceId: 'A', targetId: 'B', path: [[126.9, 37.4]], source: 'ors' },
          { barrierId: 'b2', sourceId: 'C', targetId: 'D', path: [[126.9, 37.4], [127.1, 37.6]], source: 'ors' },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useBarrierRoutes('2025Q4', true))

    await waitFor(() => expect(result.current.routes).toHaveLength(1))
    expect(result.current.routes[0].barrierId).toBe('b2')
  })
})
