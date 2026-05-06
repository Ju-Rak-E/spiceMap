import { describe, expect, it } from 'vitest'
import { COMMERCE_COLORS, type CommerceType } from '../styles/tokens'
import type { CommerceNode } from '../types/commerce'
import {
  buildDistrictCommerceClusters,
  buildDongCommerceClusters,
  isPointInFeature,
  type AdminBoundaryCollection,
} from './mapSummaries'

const [TYPE] = Object.keys(COMMERCE_COLORS) as CommerceType[]

function node(id: string, coordinates: [number, number], overrides: Partial<CommerceNode> = {}): CommerceNode {
  return {
    id,
    name: id,
    coordinates,
    type: TYPE,
    district: '강남구',
    netFlow: 200,
    degreeCentrality: 0.5,
    griScore: 20,
    closeRate: 3,
    ...overrides,
  }
}

const BOUNDARIES: AdminBoundaryCollection = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { code: 'D1', name: '테스트1동' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [0, 0],
          [2, 0],
          [2, 2],
          [0, 2],
          [0, 0],
        ]],
      },
    },
    {
      type: 'Feature',
      properties: { code: 'D2', name: '테스트2동' },
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [2, 0],
          [4, 0],
          [4, 2],
          [2, 2],
          [2, 0],
        ]],
      },
    },
  ],
}

describe('isPointInFeature', () => {
  it('returns true when a point is inside the polygon', () => {
    expect(isPointInFeature([1, 1], BOUNDARIES.features[0])).toBe(true)
  })

  it('returns false when a point is outside the polygon', () => {
    expect(isPointInFeature([3, 1], BOUNDARIES.features[0])).toBe(false)
  })
})

describe('buildDongCommerceClusters', () => {
  it('groups commerce nodes by containing dong polygon', () => {
    const clusters = buildDongCommerceClusters([
      node('a', [0.5, 0.5]),
      node('b', [1.5, 1.5]),
      node('c', [3, 1]),
    ], BOUNDARIES)

    expect(clusters).toHaveLength(2)
    expect(clusters.find((cluster) => cluster.dongCode === 'D1')?.commerceCount).toBe(2)
    expect(clusters.find((cluster) => cluster.dongCode === 'D2')?.commerceCount).toBe(1)
  })

  it('counts recommended nodes and tracks the best startup score', () => {
    const clusters = buildDongCommerceClusters([
      node('recommended', [0.5, 0.5], { griScore: 20, netFlow: 200 }),
      node('weak', [1.5, 1.5], { griScore: 90, netFlow: -200, closeRate: 12 }),
    ], BOUNDARIES)

    const cluster = clusters[0]
    expect(cluster.recommendedCount).toBe(1)
    expect(cluster.bestScore).toBeGreaterThan(70)
    expect(cluster.tone).toBe('recommended')
  })

  it('keeps unmatched nodes in a fallback cluster', () => {
    const clusters = buildDongCommerceClusters([node('outside', [10, 10])], BOUNDARIES)

    expect(clusters).toHaveLength(1)
    expect(clusters[0].dongCode).toBe('unknown')
    expect(clusters[0].commerceCount).toBe(1)
  })
})

describe('buildDistrictCommerceClusters', () => {
  it('groups commerce nodes by district before dong-level zoom', () => {
    const clusters = buildDistrictCommerceClusters([
      node('gangnam-a', [0.5, 0.5], { district: '강남구' }),
      node('gangnam-b', [1.5, 1.5], { district: '강남구' }),
      node('gwanak-a', [3, 1], { district: '관악구' }),
    ])

    expect(clusters).toHaveLength(2)
    expect(clusters.find((cluster) => cluster.dongName === '강남구')?.commerceCount).toBe(2)
    expect(clusters.find((cluster) => cluster.dongName === '관악구')?.commerceCount).toBe(1)
    expect(clusters.every((cluster) => cluster.level === 'district')).toBe(true)
  })
})
