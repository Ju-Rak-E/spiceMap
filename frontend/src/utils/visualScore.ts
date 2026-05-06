import type { CommerceNode } from '../types/commerce'
import { deriveStartupSummary } from './startupAdvisor'

const MIN_VISUAL_SCORE = 20
const MAX_VISUAL_SCORE = 100

export function normalizeVisualScores(nodes: CommerceNode[]): Map<string, number> {
  const scored = nodes
    .map((node) => ({ id: node.id, score: deriveStartupSummary(node).fitScore }))
    .sort((a, b) => a.score - b.score)

  const result = new Map<string, number>()
  if (scored.length === 0) return result
  if (scored.length === 1) {
    result.set(scored[0].id, MAX_VISUAL_SCORE)
    return result
  }

  const maxRank = scored.length - 1
  scored.forEach((item, index) => {
    const percentile = index / maxRank
    result.set(
      item.id,
      Math.round(MIN_VISUAL_SCORE + percentile * (MAX_VISUAL_SCORE - MIN_VISUAL_SCORE)),
    )
  })
  return result
}

export function resolveVisualScore(
  node: CommerceNode,
  visualScores: ReadonlyMap<string, number>,
): number {
  return visualScores.get(node.id) ?? deriveStartupSummary(node).fitScore
}
