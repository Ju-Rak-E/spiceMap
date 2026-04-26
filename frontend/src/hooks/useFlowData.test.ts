import { describe, it, expect } from 'vitest'
import { filterFlows, computeStats, applyHourWeight, getHourScale, type ODFlow } from './useFlowData'

const SAMPLE_FLOWS: ODFlow[] = [
  {
    id: 'f1',
    sourceId: '관악구_봉천동',
    targetId: '강남구_역삼동',
    sourceCoord: [126.952, 37.477],
    targetCoord: [127.036, 37.500],
    volume: 8500,
    purpose: '출근',
  },
  {
    id: 'f2',
    sourceId: '강남구_신사동',
    targetId: '강남구_역삼동',
    sourceCoord: [127.020, 37.526],
    targetCoord: [127.036, 37.500],
    volume: 5200,
    purpose: '쇼핑',
  },
  {
    id: 'f3',
    sourceId: '관악구_신림동',
    targetId: '관악구_봉천동',
    sourceCoord: [126.929, 37.484],
    targetCoord: [126.952, 37.477],
    volume: 3100,
    purpose: '출근',
  },
  {
    id: 'f4',
    sourceId: '강남구_역삼동',
    targetId: '관악구_신림동',
    sourceCoord: [127.036, 37.500],
    targetCoord: [126.929, 37.484],
    volume: 1200,
    purpose: '귀가',
  },
  {
    id: 'f5',
    sourceId: '관악구_봉천동',
    targetId: '강남구_신사동',
    sourceCoord: [126.952, 37.477],
    targetCoord: [127.020, 37.526],
    volume: 900,
    purpose: '쇼핑',
  },
]

describe('filterFlows', () => {
  describe('purpose 필터', () => {
    it('특정 목적만 필터링해야 한다', () => {
      const result = filterFlows(SAMPLE_FLOWS, { purpose: '출근' })
      expect(result).toHaveLength(2)
      expect(result.every(f => f.purpose === '출근')).toBe(true)
    })

    it('purpose가 null이면 전체를 반환해야 한다', () => {
      const result = filterFlows(SAMPLE_FLOWS, { purpose: null })
      expect(result).toHaveLength(SAMPLE_FLOWS.length)
    })

    it('purpose가 없으면 전체를 반환해야 한다', () => {
      const result = filterFlows(SAMPLE_FLOWS, {})
      expect(result).toHaveLength(SAMPLE_FLOWS.length)
    })

    it('해당하는 흐름이 없으면 빈 배열을 반환해야 한다', () => {
      const result = filterFlows(SAMPLE_FLOWS, { purpose: '여가' })
      expect(result).toHaveLength(0)
    })
  })

  describe('topN 필터', () => {
    it('volume 기준 상위 N개만 반환해야 한다', () => {
      const result = filterFlows(SAMPLE_FLOWS, { topN: 3 })
      expect(result).toHaveLength(3)
      expect(result[0].volume).toBe(8500)
      expect(result[1].volume).toBe(5200)
      expect(result[2].volume).toBe(3100)
    })

    it('topN이 전체 개수보다 크면 전체를 반환해야 한다', () => {
      const result = filterFlows(SAMPLE_FLOWS, { topN: 100 })
      expect(result).toHaveLength(SAMPLE_FLOWS.length)
    })

    it('원본 배열을 변경하지 않아야 한다 (불변성)', () => {
      const original = [...SAMPLE_FLOWS]
      filterFlows(SAMPLE_FLOWS, { topN: 2 })
      expect(SAMPLE_FLOWS).toEqual(original)
    })
  })

  describe('복합 필터', () => {
    it('purpose + topN 조합이 동작해야 한다', () => {
      const result = filterFlows(SAMPLE_FLOWS, { purpose: '출근', topN: 1 })
      expect(result).toHaveLength(1)
      expect(result[0].purpose).toBe('출근')
      expect(result[0].volume).toBe(8500)
    })
  })
})

describe('getHourScale', () => {
  it('피크 시간에 가장 높은 배율(≈1.0)을 반환해야 한다', () => {
    expect(getHourScale('출근', 8)).toBeCloseTo(1.0, 1)
    expect(getHourScale('쇼핑', 14)).toBeCloseTo(1.0, 1)
    expect(getHourScale('여가', 20)).toBeCloseTo(1.0, 1)
    expect(getHourScale('귀가', 19)).toBeCloseTo(1.0, 1)
  })

  it('피크에서 멀어질수록 배율이 낮아야 한다', () => {
    const peak = getHourScale('출근', 8)
    const off = getHourScale('출근', 14)
    expect(peak).toBeGreaterThan(off)
  })

  it('최솟값은 0.1 이상이어야 한다', () => {
    expect(getHourScale('출근', 0)).toBeGreaterThanOrEqual(0.1)
    expect(getHourScale('쇼핑', 3)).toBeGreaterThanOrEqual(0.1)
  })
})

describe('filterFlows — hour 스케일링', () => {
  it('출근 흐름은 8시가 14시보다 volume이 커야 한다', () => {
    const flows: ODFlow[] = [{
      id: 'x', sourceId: 'a', targetId: 'b',
      sourceCoord: [0, 0], targetCoord: [1, 1],
      volume: 10000, purpose: '출근',
    }]
    const at8 = filterFlows(flows, { hour: 8 })[0].volume
    const at14 = filterFlows(flows, { hour: 14 })[0].volume
    expect(at8).toBeGreaterThan(at14)
  })

  it('hour 없으면 volume이 변하지 않아야 한다', () => {
    const flows: ODFlow[] = [{
      id: 'x', sourceId: 'a', targetId: 'b',
      sourceCoord: [0, 0], targetCoord: [1, 1],
      volume: 5000, purpose: '쇼핑',
    }]
    const result = filterFlows(flows, {})[0].volume
    expect(result).toBe(5000)
  })

  it('원본 flows 배열을 변경하지 않아야 한다 (불변성)', () => {
    const flows: ODFlow[] = [{
      id: 'x', sourceId: 'a', targetId: 'b',
      sourceCoord: [0, 0], targetCoord: [1, 1],
      volume: 5000, purpose: '쇼핑',
    }]
    filterFlows(flows, { hour: 3 })
    expect(flows[0].volume).toBe(5000)
  })
})

describe('computeStats', () => {
  it('총 이동량을 올바르게 합산해야 한다', () => {
    const stats = computeStats(SAMPLE_FLOWS)
    expect(stats.totalVolume).toBe(8500 + 5200 + 3100 + 1200 + 900)
  })

  it('활성 흐름 수를 올바르게 세야 한다', () => {
    const stats = computeStats(SAMPLE_FLOWS)
    expect(stats.activeCount).toBe(5)
  })

  it('최대 유입 상권을 올바르게 찾아야 한다', () => {
    const stats = computeStats(SAMPLE_FLOWS)
    expect(stats.topInflow).toBe('강남구_역삼동')
  })

  it('최대 유출 상권을 올바르게 찾아야 한다', () => {
    const stats = computeStats(SAMPLE_FLOWS)
    expect(stats.topOutflow).toBe('관악구_봉천동')
  })

  it('빈 배열이면 null과 0을 반환해야 한다', () => {
    const stats = computeStats([])
    expect(stats.totalVolume).toBe(0)
    expect(stats.activeCount).toBe(0)
    expect(stats.topInflow).toBeNull()
    expect(stats.topOutflow).toBeNull()
  })
})

describe('applyHourWeight', () => {
  const BASE_FLOWS: ODFlow[] = [
    {
      id: 'h1',
      sourceId: 'A',
      targetId: 'B',
      sourceCoord: [126.9, 37.5],
      targetCoord: [127.0, 37.5],
      volume: 1000,
      purpose: '출근',
    },
  ]

  it('출근 피크(8시)에 원본 볼륨의 100%를 반환한다', () => {
    const result = applyHourWeight(BASE_FLOWS, 8)
    expect(result[0].volume).toBe(1000)
  })

  it('새벽(3시)에 볼륨이 줄어든다', () => {
    const result = applyHourWeight(BASE_FLOWS, 3)
    expect(result[0].volume).toBeLessThan(1000)
  })

  it('저녁 피크(18시)에 볼륨이 크다', () => {
    const peak8 = applyHourWeight(BASE_FLOWS, 8)[0].volume
    const peak18 = applyHourWeight(BASE_FLOWS, 18)[0].volume
    expect(peak18).toBeGreaterThan(500)
    expect(peak8).toBeGreaterThan(500)
  })

  it('원본 배열을 변경하지 않는다 (불변성)', () => {
    const original = BASE_FLOWS[0].volume
    applyHourWeight(BASE_FLOWS, 8)
    expect(BASE_FLOWS[0].volume).toBe(original)
  })

  it('볼륨은 항상 양의 정수를 반환한다', () => {
    for (let h = 0; h < 24; h++) {
      const result = applyHourWeight(BASE_FLOWS, h)
      expect(result[0].volume).toBeGreaterThan(0)
    }
  })
})
