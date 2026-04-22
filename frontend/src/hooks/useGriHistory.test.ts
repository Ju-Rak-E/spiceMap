import { describe, it, expect } from 'vitest'
import { buildGriSeries, type GriPoint } from './useGriHistory'

const MOCK_SERIES: GriPoint[] = [
  { ts: '2025-01', gri: 60 },
  { ts: '2025-02', gri: 65 },
  { ts: '2025-03', gri: 70 },
]

describe('buildGriSeries', () => {
  it('정렬된 시계열을 그대로 반환한다', () => {
    const result = buildGriSeries(MOCK_SERIES)
    expect(result).toHaveLength(3)
    expect(result[0].ts).toBe('2025-01')
    expect(result[2].gri).toBe(70)
  })

  it('ts 오름차순으로 정렬한다', () => {
    const unsorted: GriPoint[] = [
      { ts: '2025-03', gri: 70 },
      { ts: '2025-01', gri: 60 },
      { ts: '2025-02', gri: 65 },
    ]
    const result = buildGriSeries(unsorted)
    expect(result[0].ts).toBe('2025-01')
    expect(result[1].ts).toBe('2025-02')
    expect(result[2].ts).toBe('2025-03')
  })

  it('빈 배열이면 빈 배열을 반환한다', () => {
    expect(buildGriSeries([])).toHaveLength(0)
  })

  it('원본 배열을 변경하지 않는다 (불변성)', () => {
    const original: GriPoint[] = [
      { ts: '2025-03', gri: 70 },
      { ts: '2025-01', gri: 60 },
    ]
    const copy = [...original]
    buildGriSeries(original)
    expect(original).toEqual(copy)
  })
})
