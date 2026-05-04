import { describe, expect, it } from 'vitest'
import { createFlowBarrierLayer } from './FlowBarrierLayer'
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
})
