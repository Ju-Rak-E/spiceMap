import { describe, expect, it } from 'vitest'
import { selectBalancedBarriers } from './barrierSelection'
import type { Barrier } from '../hooks/useBarriers'

function barrier(id: string, sourceId: string, targetId: string, score: number): Barrier {
  return {
    id,
    sourceId,
    targetId,
    sourceName: sourceId,
    targetName: targetId,
    sourceCoord: [127, 37],
    targetCoord: [127.1, 37.1],
    affectedVolume: Math.round(score * 1000),
    score,
    severity: score >= 0.75 ? 'high' : score >= 0.45 ? 'medium' : 'low',
    type: null,
  }
}

describe('selectBalancedBarriers', () => {
  it('keeps the existing severity-balanced ranking without district options', () => {
    const result = selectBalancedBarriers([
      barrier('m1', 'g1', 'g2', 0.7),
      barrier('h1', 'g3', 'g4', 0.9),
      barrier('l1', 'g5', 'g6', 0.3),
      barrier('h2', 'g7', 'g8', 0.8),
    ], 3)

    expect(result.map((item) => item.id)).toEqual(['h1', 'm1', 'l1'])
  })

  it('reserves quota for each selected district when enough barriers exist', () => {
    const barriers = [
      barrier('gn-1', 'gn-a', 'gn-b', 0.55),
      barrier('gn-2', 'gn-c', 'gn-d', 0.5),
      barrier('ga-1', 'ga-a', 'ga-b', 0.95),
      barrier('ga-2', 'ga-c', 'ga-d', 0.9),
      barrier('ga-3', 'ga-e', 'ga-f', 0.85),
      barrier('ga-4', 'ga-g', 'ga-h', 0.8),
    ]
    const nodeDistrictMap = new Map([
      ['gn-a', 'Gangnam'], ['gn-b', 'Gangnam'],
      ['gn-c', 'Gangnam'], ['gn-d', 'Gangnam'],
      ['ga-a', 'Gwanak'], ['ga-b', 'Gwanak'],
      ['ga-c', 'Gwanak'], ['ga-d', 'Gwanak'],
      ['ga-e', 'Gwanak'], ['ga-f', 'Gwanak'],
      ['ga-g', 'Gwanak'], ['ga-h', 'Gwanak'],
    ])

    const result = selectBalancedBarriers(barriers, 4, {
      districts: ['Gangnam', 'Gwanak'],
      nodeDistrictMap,
    })

    expect(result.filter((item) => item.id.startsWith('gn-'))).toHaveLength(2)
    expect(result.filter((item) => item.id.startsWith('ga-'))).toHaveLength(2)
  })

  it('fills leftover slots from other districts when one district has too few barriers', () => {
    const barriers = [
      barrier('gn-1', 'gn-a', 'gn-b', 0.55),
      barrier('ga-1', 'ga-a', 'ga-b', 0.95),
      barrier('ga-2', 'ga-c', 'ga-d', 0.9),
      barrier('ga-3', 'ga-e', 'ga-f', 0.85),
    ]
    const nodeDistrictMap = new Map([
      ['gn-a', 'Gangnam'], ['gn-b', 'Gangnam'],
      ['ga-a', 'Gwanak'], ['ga-b', 'Gwanak'],
      ['ga-c', 'Gwanak'], ['ga-d', 'Gwanak'],
      ['ga-e', 'Gwanak'], ['ga-f', 'Gwanak'],
    ])

    const result = selectBalancedBarriers(barriers, 4, {
      districts: ['Gangnam', 'Gwanak'],
      nodeDistrictMap,
    })

    expect(result).toHaveLength(4)
    expect(result.filter((item) => item.id.startsWith('gn-'))).toHaveLength(1)
    expect(result.filter((item) => item.id.startsWith('ga-'))).toHaveLength(3)
  })
})
