import { describe, expect, it } from 'vitest'
import {
  FLOW_PROGRESS_PER_MS,
  getAnimatedParticleCount,
  getDensityAnimationScale,
  getFlowProgressIncrement,
  getZoomAnimationScale,
} from './flowAnimation'

describe('flow animation pace', () => {
  it('keeps progress pace independent of zoom and density', () => {
    expect(getFlowProgressIncrement(1000)).toBe(FLOW_PROGRESS_PER_MS * 1000)
  })

  it('reduces animated particle amount as the map zooms in', () => {
    expect(getZoomAnimationScale(18)).toBeLessThan(getZoomAnimationScale(9))
  })

  it('increases animated particle amount as visualization density rises', () => {
    expect(getDensityAnimationScale(5)).toBeGreaterThan(getDensityAnimationScale(1))
  })

  it('uses zoom and density to scale particle count', () => {
    const lowDensityZoomedIn = getAnimatedParticleCount(4, 18, 1)
    const highDensityZoomedOut = getAnimatedParticleCount(4, 9, 5)
    expect(highDensityZoomedOut).toBeGreaterThan(lowDensityZoomedIn)
  })

  it('keeps the animation density cap modest', () => {
    expect(getAnimatedParticleCount(8, 9, 5)).toBe(5)
  })

  it('ignores negative frame deltas', () => {
    expect(getFlowProgressIncrement(-16)).toBe(0)
  })
})
