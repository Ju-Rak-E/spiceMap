// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { useGriHistory, type GriHistoryPoint } from './useGriHistory'

const MOCK_HISTORY: GriHistoryPoint[] = [
  { quarter: '2024Q3', score: 55, level: 'safe' },
  { quarter: '2024Q4', score: 62, level: 'safe' },
  { quarter: '2025Q1', score: 71, level: 'warning' },
  { quarter: '2025Q2', score: 78, level: 'warning' },
]

describe('useGriHistory', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('nodeId 없으면 빈 배열 즉시 반환', () => {
    const { result } = renderHook(() => useGriHistory(null))
    expect(result.current.history).toEqual([])
    expect(result.current.isLoading).toBe(false)
  })

  it('API 성공 시 history 반환, isMock=false', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'http://test-api')
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ nodeId: 'node_01', history: MOCK_HISTORY }),
    } as Response)

    const { result } = renderHook(() => useGriHistory('node_01'))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.history).toHaveLength(4)
    expect(result.current.isMock).toBe(false)
    vi.unstubAllEnvs()
  })

  it('API 실패 시 mock 폴백, isMock=true', async () => {
    globalThis.fetch = vi.fn()
      .mockRejectedValueOnce(new Error('network error'))
      .mockResolvedValue({
        ok: true,
        json: async () => MOCK_HISTORY,
      } as Response)

    const { result } = renderHook(() => useGriHistory('node_01'))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.isMock).toBe(true)
    expect(result.current.history.length).toBeGreaterThan(0)
  })

  it('nodeId 변경 시 새로 페칭', async () => {
    let callCount = 0
    globalThis.fetch = vi.fn().mockImplementation(() => {
      callCount++
      return Promise.resolve({
        ok: true,
        json: async () => ({ nodeId: 'node', history: MOCK_HISTORY }),
      } as Response)
    })

    const { rerender } = renderHook(
      ({ id }: { id: string }) => useGriHistory(id),
      { initialProps: { id: 'node_01' } },
    )

    await waitFor(() => expect(callCount).toBe(1))
    rerender({ id: 'node_02' })
    await waitFor(() => expect(callCount).toBe(2))
  })
})
