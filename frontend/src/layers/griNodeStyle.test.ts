import { describe, expect, it } from 'vitest'
import {
  getCandidateFillColor,
  getCandidateNodes,
  getContextFillColor,
  getGriBorderColor,
  getGriBorderWidth,
} from './CommerceNodeLayer'
import type { CommerceNode } from '../types/commerce'
import type { CommerceType } from '../styles/tokens'
import { COMMERCE_COLORS } from '../styles/tokens'
import { hexToRgb } from '../utils/colorUtils'

const [TYPE] = Object.keys(COMMERCE_COLORS) as CommerceType[]

function buildNode(overrides: Partial<CommerceNode> = {}): CommerceNode {
  return {
    id: 'test',
    name: 'test',
    coordinates: [127, 37.5],
    district: '강남구',
    type: TYPE,
    netFlow: 0,
    degreeCentrality: 0,
    griScore: 0,
    ...overrides,
  }
}

describe('commerce node outline style', () => {
  it('hides outlines for unselected nodes regardless of GRI', () => {
    expect(getGriBorderColor(80, false)).toEqual([0, 0, 0, 0])
    expect(getGriBorderColor(45, false)).toEqual([0, 0, 0, 0])
    expect(getGriBorderWidth(80, false)).toBe(0)
    expect(getGriBorderWidth(20, false)).toBe(0)
  })

  it('shows one consistent outline for the selected node', () => {
    expect(getGriBorderColor(90, true)).toEqual([123, 208, 141, 255])
    expect(getGriBorderWidth(10, true)).toBe(3)
  })
})

describe('candidate node fill color (by startup fit)', () => {
  it('recommended nodes use startup recommendation green', () => {
    const node = buildNode({ griScore: 20, netFlow: 200, degreeCentrality: 0.5, closeRate: 3 })
    const [r, g, b] = hexToRgb('#43A047')
    expect(getCandidateFillColor(node, false)).toEqual([r, g, b, 230])
  })

  it('caution nodes use startup caution orange', () => {
    const node = buildNode({ griScore: 50, netFlow: 50, degreeCentrality: 0.3, closeRate: 5 })
    const [r, g, b] = hexToRgb('#FB8C00')
    expect(getCandidateFillColor(node, false)).toEqual([r, g, b, 200])
  })

  it('not recommended nodes use startup risk red', () => {
    const node = buildNode({ griScore: 80, netFlow: -50, degreeCentrality: 0.1, closeRate: 12 })
    const [r, g, b] = hexToRgb('#E53935')
    expect(getCandidateFillColor(node, false)).toEqual([r, g, b, 170])
  })

  it('selected nodes always use alpha 255', () => {
    const node = buildNode({ griScore: 80, netFlow: -50, degreeCentrality: 0.1, closeRate: 12 })
    const [r, g, b] = hexToRgb('#E53935')
    expect(getCandidateFillColor(node, true)).toEqual([r, g, b, 255])
  })
})

describe('context node fill color (by startup fit)', () => {
  it('uses startup fit color with low alpha 105', () => {
    const node = buildNode({ griScore: 20, netFlow: 200, degreeCentrality: 0.5, closeRate: 3 })
    const [r, g, b] = hexToRgb('#43A047')
    expect(getContextFillColor(node)).toEqual([r, g, b, 105])
  })

  it('preserves startup judgment distinction in context layer', () => {
    const recommended = getContextFillColor(buildNode({ griScore: 20, netFlow: 200, degreeCentrality: 0.5, closeRate: 3 }))
    const notRecommended = getContextFillColor(buildNode({ griScore: 80, netFlow: -50, degreeCentrality: 0.1, closeRate: 12 }))
    expect(recommended).not.toEqual(notRecommended)
  })
})

describe('getCandidateNodes', () => {
  it('includes nodes with caution fitLevel', () => {
    const cautionNode = buildNode({
      id: 'caution-1',
      griScore: 44,
      netFlow: 180,
      degreeCentrality: 0.52,
      closeRate: 9.8,
    })
    const result = getCandidateNodes([cautionNode], null)
    expect(result.map((n) => n.id)).toContain('caution-1')
  })

  it('includes nodes with not_recommended fitLevel', () => {
    const lowFitNode = buildNode({
      id: 'low-fit-1',
      griScore: 88,
      netFlow: 1200,
      degreeCentrality: 0.95,
      closeRate: 3.2,
    })
    const result = getCandidateNodes([lowFitNode], null)
    expect(result.map((n) => n.id)).toContain('low-fit-1')
  })

  it('excludes unknown nodes with no analysis data', () => {
    const unknownNode = buildNode({
      id: 'unknown-1',
      griScore: 0,
      netFlow: 0,
      closeRate: undefined,
    })
    const result = getCandidateNodes([unknownNode], null)
    expect(result.map((n) => n.id)).not.toContain('unknown-1')
  })

  it('sorts by fitScore descending so high-fit nodes render last', () => {
    const high = buildNode({ id: 'high', griScore: 20, netFlow: 100, degreeCentrality: 0.5, closeRate: 3 })
    const mid = buildNode({ id: 'mid', griScore: 50, netFlow: 50, degreeCentrality: 0.3, closeRate: 5 })
    const low = buildNode({ id: 'low', griScore: 80, netFlow: -50, degreeCentrality: 0.1, closeRate: 12 })
    const result = getCandidateNodes([low, mid, high], null)
    expect(result.map((n) => n.id)).toEqual(['high', 'mid', 'low'])
  })

  it('always includes selected node even if not in top candidates', () => {
    const candidates = Array.from({ length: 50 }, (_, i) =>
      buildNode({
        id: `c${i}`,
        griScore: 30,
        netFlow: 100,
        degreeCentrality: 0.5,
        closeRate: 3,
      }),
    )
    const selected = buildNode({
      id: 'selected',
      griScore: 90,
      netFlow: -500,
      degreeCentrality: 0.05,
      closeRate: 18,
    })
    const result = getCandidateNodes([...candidates, selected], 'selected')
    expect(result.map((n) => n.id)).toContain('selected')
  })
})
