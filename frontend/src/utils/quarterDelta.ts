import type { CommerceNode } from '../types/commerce'
import { deriveStartupSummary } from './startupAdvisor'

export interface QuarterKpi {
  totalVolume: number
  avgGri: number
  commerceCount: number
  recommendedCount: number
}

export interface QuarterKpiDelta {
  current: QuarterKpi
  previous: QuarterKpi
  delta: {
    totalVolume: number
    avgGri: number
    commerceCount: number
    recommendedCount: number
  }
}

export function computeKpi(nodes: CommerceNode[], totalVolume: number): QuarterKpi {
  const commerceCount = nodes.length
  if (commerceCount === 0) {
    return { totalVolume, avgGri: 0, commerceCount: 0, recommendedCount: 0 }
  }

  const avgGri = nodes.reduce((sum, node) => sum + node.griScore, 0) / commerceCount
  const recommendedCount = nodes.filter(
    (node) => deriveStartupSummary(node).fitLevel === 'recommended',
  ).length

  return { totalVolume, avgGri, commerceCount, recommendedCount }
}

export function computeKpiDelta(current: QuarterKpi, previous: QuarterKpi): QuarterKpiDelta {
  return {
    current,
    previous,
    delta: {
      totalVolume: current.totalVolume - previous.totalVolume,
      avgGri: current.avgGri - previous.avgGri,
      commerceCount: current.commerceCount - previous.commerceCount,
      recommendedCount: current.recommendedCount - previous.recommendedCount,
    },
  }
}

export function getPreviousQuarter(quarter: string, quarters: readonly string[]): string | null {
  const idx = quarters.indexOf(quarter)
  if (idx <= 0) return null
  return quarters[idx - 1]
}

export function formatDelta(value: number, fractionDigits = 1): string {
  if (Math.abs(value) < Number.EPSILON) return '±0'
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toLocaleString(undefined, {
    maximumFractionDigits: fractionDigits,
  })}`
}

export function deltaTone(value: number, betterWhen: 'higher' | 'lower' = 'higher'): 'up' | 'down' | 'flat' {
  if (Math.abs(value) < Number.EPSILON) return 'flat'
  if (betterWhen === 'higher') return value > 0 ? 'up' : 'down'
  return value > 0 ? 'down' : 'up'
}
