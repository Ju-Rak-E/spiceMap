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
  it('uses red outline for GRI 70 and above', () => {
    expect(getGriBorderColor(80, false)).toEqual([239, 83, 80, 255])
    expect(getGriBorderWidth(80, false)).toBe(3)
  })

  it('uses orange outline for GRI 40 to 69', () => {
    expect(getGriBorderColor(45, false)).toEqual([255, 167, 38, 255])
    expect(getGriBorderWidth(45, false)).toBe(2)
  })

  it('uses light outline for GRI below 40', () => {
    expect(getGriBorderColor(20, false)).toEqual([236, 239, 241, 170])
    expect(getGriBorderWidth(20, false)).toBe(1)
  })

  it('shows one consistent outline for the selected node', () => {
    expect(getGriBorderColor(90, true)).toEqual([255, 255, 255, 255])
    expect(getGriBorderWidth(10, true)).toBe(4)
  })
})

describe('candidate node fill color (by commerce type)', () => {
  it('candidate nodes use commerce type fill color', () => {
    const node = buildNode({ type: '흡수형_과열', griScore: 20, netFlow: 200, degreeCentrality: 0.5, closeRate: 3 })
    const [r, g, b] = hexToRgb(COMMERCE_COLORS.흡수형_과열.fill)
    expect(getCandidateFillColor(node, false)).toEqual([r, g, b, 230])
  })

  it('selected nodes always use alpha 255', () => {
    const node = buildNode({ type: '방출형_침체', griScore: 80, netFlow: -50, degreeCentrality: 0.1, closeRate: 12 })
    const [r, g, b] = hexToRgb(COMMERCE_COLORS.방출형_침체.fill)
    expect(getCandidateFillColor(node, true)).toEqual([r, g, b, 255])
  })
})

describe('context node fill color (by commerce type)', () => {
  it('uses commerce type fill color with low alpha 90', () => {
    const node = buildNode({ type: '흡수형_성장', griScore: 20, netFlow: 200, degreeCentrality: 0.5, closeRate: 3 })
    const [r, g, b] = hexToRgb(COMMERCE_COLORS.흡수형_성장.fill)
    expect(getContextFillColor(node)).toEqual([r, g, b, 90])
  })

  it('preserves commerce type distinction in context layer', () => {
    const hot = getContextFillColor(buildNode({ type: '흡수형_과열', griScore: 20, netFlow: 200, degreeCentrality: 0.5, closeRate: 3 }))
    const isolated = getContextFillColor(buildNode({ type: '고립형_단절', griScore: 20, netFlow: 200, degreeCentrality: 0.5, closeRate: 3 }))
    expect(hot).not.toEqual(isolated)
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
