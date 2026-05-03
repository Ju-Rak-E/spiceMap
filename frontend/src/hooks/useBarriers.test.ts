import { describe, expect, it } from 'vitest'
import { normalizeBackendBarriers } from './useBarriers'

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
