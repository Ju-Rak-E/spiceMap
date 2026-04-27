import { describe, it, expect } from 'vitest'
import { buildGriSeries, getPeriodRank, normalizeGriHistoryResponse, type GriPoint } from './useGriHistory'

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

describe('normalizeGriHistoryResponse', () => {
  it('백엔드 래핑 응답을 차트 시계열로 변환한다', () => {
    const result = normalizeGriHistoryResponse({
      comm_cd: '3110001',
      comm_nm: '테스트 상권',
      history: [
        { quarter: '2025Q2', gri_score: 72, flow_volume: 1500 },
        { quarter: '2025Q1', gri_score: 64, flow_volume: 1200 },
      ],
    })

    expect(result).toEqual([
      { ts: '2025Q1', gri: 64, flowVolume: 1200 },
      { ts: '2025Q2', gri: 72, flowVolume: 1500 },
    ])
  })

  it('빈 history면 빈 배열을 반환한다', () => {
    const result = normalizeGriHistoryResponse({
      comm_cd: '3110001',
      comm_nm: null,
      history: [],
    })

    expect(result).toEqual([])
  })

  it('gri_score가 null인 행은 제외한다', () => {
    const result = normalizeGriHistoryResponse({
      comm_cd: '3110001',
      comm_nm: null,
      history: [
        { quarter: '2025Q1', gri_score: null, flow_volume: 100 },
        { quarter: '2025Q2', gri_score: 55, flow_volume: null },
      ],
    })

    expect(result).toEqual([{ ts: '2025Q2', gri: 55, flowVolume: null }])
  })
})

describe('getPeriodRank', () => {
  it('분기와 월 단위를 같은 축으로 비교할 수 있게 변환한다', () => {
    expect(getPeriodRank('2025Q1')).toBe(getPeriodRank('2025-03'))
    expect(getPeriodRank('2025-04')).toBeGreaterThan(getPeriodRank('2025Q1'))
    expect(getPeriodRank('2024Q4')).toBeLessThan(getPeriodRank('2025Q1'))
  })
})
