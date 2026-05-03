import { describe, expect, it } from 'vitest'
import type { CommerceNode } from '../types/commerce'
import { normalizeVisualScores, resolveVisualScore } from './visualScore'

function node(id: string, griScore: number): CommerceNode {
  return {
    id,
    name: id,
    coordinates: [127, 37.5],
    district: '강남구',
    type: '안정형',
    netFlow: 200,
    degreeCentrality: 0.5,
    griScore,
    closeRate: 5,
  }
}

describe('normalizeVisualScores', () => {
  it('spreads candidate scores across a visible percentile range', () => {
    const scores = normalizeVisualScores([
      node('low', 85),
      node('mid', 55),
      node('high', 20),
    ])

    expect(scores.get('low')).toBe(20)
    expect(scores.get('mid')).toBe(60)
    expect(scores.get('high')).toBe(100)
  })

  it('uses max visual score for a single visible node', () => {
    const scores = normalizeVisualScores([node('only', 50)])
    expect(scores.get('only')).toBe(100)
  })
})

describe('resolveVisualScore', () => {
  it('falls back to raw fit score when a node is not in the visual map', () => {
    const n = node('missing', 40)
    expect(resolveVisualScore(n, new Map())).toBeGreaterThan(0)
  })
})
