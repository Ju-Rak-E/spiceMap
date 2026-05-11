import { describe, expect, it } from 'vitest'
import {
  createFlowParticleLayer,
  getFlowParticleCount,
  getFlowParticlePixelBounds,
  getFlowParticleRadius,
} from './FlowParticleLayer'
import type { ODFlow } from '../hooks/useFlowData'

const flow: ODFlow = {
  id: 'a-b',
  sourceId: 'A',
  targetId: 'B',
  sourceCoord: [126.9, 37.5],
  targetCoord: [126.95, 37.52],
  volume: 5000,
  purpose: '출근',
}

describe('FlowParticleLayer animation density', () => {
  it('shows fewer moving particles when zoomed in with low visualization density', () => {
    const zoomedInLowDensity = getFlowParticleCount(10000, { zoom: 18, flowStrength: 1 })
    const zoomedOutHighDensity = getFlowParticleCount(10000, { zoom: 9, flowStrength: 5 })

    expect(zoomedOutHighDensity).toBeGreaterThan(zoomedInLowDensity)
  })

  it('keeps at least one particle for visible flows', () => {
    expect(getFlowParticleCount(1, { zoom: 18, flowStrength: 1 })).toBe(1)
  })

  it('caps dense large flows within the absolute maximum of 5', () => {
    expect(getFlowParticleCount(10000, { zoom: 9, flowStrength: 5 })).toBeLessThanOrEqual(5)
  })
})

describe('FlowParticleLayer zoom radius', () => {
  it('uses smaller particle radii when zoomed out', () => {
    const zoomedOut = getFlowParticleRadius(10000, { zoom: 9, flowStrength: 3 })
    const zoomedIn = getFlowParticleRadius(10000, { zoom: 15, flowStrength: 3 })

    expect(zoomedOut).toBeLessThan(zoomedIn)
  })

  it('lowers pixel bounds when zoomed out', () => {
    const zoomedOut = getFlowParticlePixelBounds(9)
    const zoomedIn = getFlowParticlePixelBounds(15)

    expect(zoomedOut.min).toBeLessThan(zoomedIn.min)
    expect(zoomedOut.max).toBeLessThan(zoomedIn.max)
  })

  it('renders particles above polygon and 3D layers', () => {
    const layer = createFlowParticleLayer([flow], 0)

    expect(layer.props.parameters).toEqual({ depthCompare: 'always', depthWriteEnabled: false })
  })
})
