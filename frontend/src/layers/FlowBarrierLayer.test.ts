import { describe, expect, it } from 'vitest'
import {
  createFlowBarrierLayer,
  createFlowBarrierLayers,
  getBarrierRoutePath,
  getBarrierWidth,
} from './FlowBarrierLayer'
import type { Barrier } from '../hooks/useBarriers'

const barrier: Barrier = {
  id: 'b1',
  sourceId: 'A',
  targetId: 'B',
  sourceName: 'A',
  targetName: 'B',
  sourceCoord: [126.9, 37.4],
  targetCoord: [127.1, 37.6],
  affectedVolume: 5000,
  score: 0.8,
  severity: 'high',
  type: null,
}

describe('createFlowBarrierLayer', () => {
  it('uses the supplied route path instead of generating a curve', () => {
    const routePath: [number, number][] = [
      [126.9, 37.4],
      [126.95, 37.45],
      [127.1, 37.6],
    ]
    const layer = createFlowBarrierLayer([barrier], new Map([['b1', routePath]]))
    const data = layer.props.data as Array<{ path: [number, number][] }>

    expect(data).toHaveLength(1)
    expect(data[0].path).toEqual(routePath)
  })

  it('omits barriers without a route path', () => {
    const layer = createFlowBarrierLayer([barrier], new Map())
    const data = layer.props.data as Array<{ path: [number, number][] }>

    expect(data).toHaveLength(0)
  })

  it('fits mock route templates to live barriers when route ids do not match', () => {
    const routePath: [number, number][] = [
      [126.7, 37.3],
      [126.75, 37.36],
      [126.82, 37.34],
      [126.9, 37.4],
    ]
    const layer = createFlowBarrierLayer([barrier], new Map([['mock-only', routePath]]))
    const data = layer.props.data as Array<{ path: [number, number][] }>

    expect(data).toHaveLength(1)
    expect(data[0].path).toHaveLength(routePath.length)
    expect(data[0].path[0]).toEqual(barrier.sourceCoord)
    expect(data[0].path[data[0].path.length - 1]).toEqual(barrier.targetCoord)
  })

  it('omits barriers when only template is degenerate (zero-length)', () => {
    const zeroLen: [number, number][] = [[126.95, 37.5], [126.95, 37.5]]
    const layer = createFlowBarrierLayer([barrier], new Map([['mock-only', zeroLen]]))
    const data = layer.props.data as Array<{ path: [number, number][] }>

    expect(data).toHaveLength(0)
  })

  it('omits barriers whose source equals target with non-matching template', () => {
    const degenerate: Barrier = {
      ...barrier,
      sourceCoord: [127.0, 37.5],
      targetCoord: [127.0, 37.5],
    }
    const template: [number, number][] = [[126.7, 37.3], [126.9, 37.4]]
    const layer = createFlowBarrierLayer([degenerate], new Map([['mock-only', template]]))
    const data = layer.props.data as Array<{ path: [number, number][] }>

    expect(data).toHaveLength(0)
  })

  it('creates a navigation-style casing under the route layer', () => {
    const routePath: [number, number][] = [
      [126.9, 37.4],
      [126.95, 37.45],
      [127.1, 37.6],
    ]
    const layers = createFlowBarrierLayers([barrier], new Map([['b1', routePath]]))

    expect(layers.map((layer) => layer.id)).toEqual(['flow-barriers-casing', 'flow-barriers-route'])
    expect(layers[0].props.pickable).toBe(false)
    expect(layers[1].props.pickable).toBe(false)
    expect(layers[0].props.parameters).toEqual({ depthCompare: 'always', depthWriteEnabled: false })
    expect(layers[1].props.parameters).toEqual({ depthCompare: 'always', depthWriteEnabled: false })
  })
})

describe('getBarrierWidth', () => {
  it('returns the minimum width at zero volume', () => {
    expect(getBarrierWidth(0)).toBe(5)
  })

  it('returns the maximum width at the cap volume', () => {
    expect(getBarrierWidth(10000)).toBe(12)
  })

  it('clamps to the maximum width above the cap', () => {
    expect(getBarrierWidth(50000)).toBe(12)
  })
})

describe('getBarrierRoutePath', () => {
  it('matches by sourceId-targetId composite key when barrier id is missing', () => {
    const path: [number, number][] = [[126.9, 37.4], [127.1, 37.6]]
    const result = getBarrierRoutePath(barrier, new Map([['A-B', path]]))

    expect(result).toEqual(path)
  })
})
