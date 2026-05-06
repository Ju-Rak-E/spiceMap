/* @vitest-environment jsdom */
import { renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { normalizeBackendBarriers, useBarriers } from './useBarriers'

afterEach(() => {
  vi.unstubAllGlobals()
})

function jsonResponse(body: unknown) {
  return { ok: true, json: async () => body }
}

describe('useBarriers', () => {
  it('fetches once without a gu param when no districts are provided', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ quarter: '2025Q4', total: 0, barriers: [] }),
    )
    vi.stubGlobal('fetch', fetchMock)

    renderHook(() => useBarriers('2025Q4'))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    const url = fetchMock.mock.calls[0][0] as string
    expect(url).toContain('/api/barriers?quarter=2025Q4')
    expect(url).not.toContain('gu=')
  })

  it('fetches each district in parallel and merges results, deduped by id', async () => {
    const fetchMock = vi.fn((input: string) => {
      const url = new URL(input, 'http://localhost')
      const gu = url.searchParams.get('gu')
      const baseRow = (suffix: string) => ({
        from_comm_cd: `${gu}-${suffix}-FROM`,
        from_comm_nm: `${gu} 출발`,
        to_comm_cd: `${gu}-${suffix}-TO`,
        to_comm_nm: `${gu} 도착`,
        barrier_score: 0.6,
        barrier_type: null,
        sourceCoord: [127.0, 37.5] as [number, number],
        targetCoord: [127.05, 37.52] as [number, number],
        affected_volume: 1000,
      })
      return Promise.resolve(jsonResponse({
        quarter: '2025Q4',
        total: 2,
        barriers: [baseRow('1'), baseRow('2')],
      }))
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useBarriers('2025Q4', new Set(['강남구', '관악구'])))

    await waitFor(() => expect(result.current.barriers).toHaveLength(4))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    const calledUrls = fetchMock.mock.calls.map(([u]) => u as string)
    expect(calledUrls.some((u) => u.includes('gu=%EA%B0%95%EB%82%A8%EA%B5%AC') || u.includes('gu=강남구'))).toBe(true)
    expect(calledUrls.some((u) => u.includes('gu=%EA%B4%80%EC%95%85%EA%B5%AC') || u.includes('gu=관악구'))).toBe(true)
    const ids = result.current.barriers.map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('deduplicates barriers with the same id from overlapping districts', async () => {
    const sharedRow = {
      from_comm_cd: 'GN-1',
      from_comm_nm: 'A',
      to_comm_cd: 'GW-1',
      to_comm_nm: 'B',
      barrier_score: 0.5,
      barrier_type: null,
      sourceCoord: [127.0, 37.5] as [number, number],
      targetCoord: [126.95, 37.48] as [number, number],
      affected_volume: 800,
    }
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({ quarter: '2025Q4', total: 1, barriers: [sharedRow] }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() =>
      useBarriers('2025Q4', new Set(['강남구', '관악구'])),
    )

    await waitFor(() => expect(result.current.barriers).toHaveLength(1))
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.current.barriers).toHaveLength(1)
    expect(result.current.barriers[0].id).toBe('GN-1-GW-1')
  })

  it('falls back to mock barriers when every district fetch fails', async () => {
    const fetchMock = vi.fn((input: string) => {
      if (typeof input === 'string' && input.endsWith('/data/mock_barriers.json')) {
        return Promise.resolve(jsonResponse([
          {
            id: 'b1',
            sourceId: 'GW_BONGCHEON',
            targetId: 'GC_YEOKSAM',
            sourceName: 'A',
            targetName: 'B',
            sourceCoord: [126.952, 37.477],
            targetCoord: [127.036, 37.5],
            affectedVolume: 100,
            score: 0.5,
            severity: 'medium',
            type: null,
          },
        ]))
      }
      return Promise.resolve({ ok: false, status: 503 })
    })
    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() => useBarriers('2025Q4', new Set(['강남구'])))

    await waitFor(() => expect(result.current.barriers).toHaveLength(1))
    expect(result.current.barriers[0].id).toBe('b1')
  })
})

describe('normalizeBackendBarriers', () => {
  it('keeps live API rows when source and target coordinates are present', () => {
    const [barrier] = normalizeBackendBarriers({
      quarter: '2025Q4',
      total: 1,
      barriers: [
        {
          from_comm_cd: 'C1',
          from_comm_nm: '출발 상권',
          to_comm_cd: 'C2',
          to_comm_nm: '도착 상권',
          barrier_score: 0.82,
          barrier_type: '유입 단절',
          sourceCoord: [127.01, 37.5],
          targetCoord: [127.05, 37.52],
        },
      ],
    })

    expect(barrier.id).toBe('C1-C2')
    expect(barrier.sourceCoord).toEqual([127.01, 37.5])
    expect(barrier.targetCoord).toEqual([127.05, 37.52])
    expect(barrier.severity).toBe('high')
  })

  it('still skips rows that cannot be drawn because coordinates are absent', () => {
    const barriers = normalizeBackendBarriers({
      quarter: '2025Q4',
      total: 1,
      barriers: [
        {
          from_comm_cd: 'C1',
          from_comm_nm: null,
          to_comm_cd: 'C2',
          to_comm_nm: null,
          barrier_score: 0.5,
          barrier_type: null,
        },
      ],
    })

    expect(barriers).toHaveLength(0)
  })
})
