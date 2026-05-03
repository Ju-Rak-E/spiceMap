import { describe, expect, it } from 'vitest'
import {
  getFlowParticleCount,
  getFlowParticlePixelBounds,
  getFlowParticleRadius,
} from './FlowParticleLayer'

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
})
