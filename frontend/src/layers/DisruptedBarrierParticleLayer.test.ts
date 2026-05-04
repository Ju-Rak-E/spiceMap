import { describe, it, expect } from 'vitest'
import {
  createDisruptedBarrierParticleLayer,
  getBarrierParticleRadiusScale,
  SEVERITY_PARTICLE_COUNT,
  SEVERITY_SCATTER_DEG,
} from './DisruptedBarrierParticleLayer'
import type { Barrier } from '../hooks/useBarriers'

const mockBarrierHigh: Barrier = {
  id: 'b1',
  sourceId: 'GW_BONGCHEON',
  targetId: 'GC_YEOKSAM',
  sourceName: '봉천동',
  targetName: '역삼동',
  sourceCoord: [126.952, 37.477],
  targetCoord: [127.036, 37.500],
  affectedVolume: 8500,
  score: 0.86,
  severity: 'high',
  type: '강남대로 도로 공사',
}

const mockBarrierLow: Barrier = {
  id: 'b5',
  sourceId: 'GC_YEOKSAM',
  targetId: 'GW_SILLIM',
  sourceName: '역삼동',
  targetName: '신림동',
  sourceCoord: [127.036, 37.500],
  targetCoord: [126.929, 37.484],
  affectedVolume: 1200,
  score: 0.32,
  severity: 'low',
  type: null,
}

describe('getBarrierParticleRadiusScale', () => {
  it('returns minimum scale (0.3) at minimum zoom (9)', () => {
    expect(getBarrierParticleRadiusScale(9)).toBeCloseTo(0.3)
  })

  it('clamps to 1 at or above full-size zoom', () => {
    expect(getBarrierParticleRadiusScale(15)).toBeCloseTo(1)
    expect(getBarrierParticleRadiusScale(18)).toBeCloseTo(1)
  })

  it('returns intermediate scale at zoom 11', () => {
    const scale = getBarrierParticleRadiusScale(11)
    expect(scale).toBeGreaterThan(0.3)
    expect(scale).toBeLessThan(1)
  })

  it('is monotonically increasing with zoom', () => {
    const s10 = getBarrierParticleRadiusScale(10)
    const s12 = getBarrierParticleRadiusScale(12)
    const s14 = getBarrierParticleRadiusScale(14)
    expect(s10).toBeLessThan(s12)
    expect(s12).toBeLessThan(s14)
  })
})

describe('SEVERITY_PARTICLE_COUNT', () => {
  it('high has more particles than medium', () => {
    expect(SEVERITY_PARTICLE_COUNT.high).toBeGreaterThan(SEVERITY_PARTICLE_COUNT.medium)
  })

  it('medium has more particles than low', () => {
    expect(SEVERITY_PARTICLE_COUNT.medium).toBeGreaterThan(SEVERITY_PARTICLE_COUNT.low)
  })
})

describe('SEVERITY_SCATTER_DEG', () => {
  it('high scatters more than medium', () => {
    expect(SEVERITY_SCATTER_DEG.high).toBeGreaterThan(SEVERITY_SCATTER_DEG.medium)
  })

  it('medium scatters more than low', () => {
    expect(SEVERITY_SCATTER_DEG.medium).toBeGreaterThan(SEVERITY_SCATTER_DEG.low)
  })
})

describe('createDisruptedBarrierParticleLayer', () => {
  it('returns a layer with the correct id', () => {
    const layer = createDisruptedBarrierParticleLayer([mockBarrierHigh], 0, 11)
    expect(layer.id).toBe('barrier-disrupted-particles')
  })

  it('handles an empty barriers array without throwing', () => {
    expect(() => createDisruptedBarrierParticleLayer([], 0, 11)).not.toThrow()
  })

  it('does not throw at progress = 0', () => {
    expect(() => createDisruptedBarrierParticleLayer([mockBarrierHigh], 0, 11)).not.toThrow()
  })

  it('does not throw at progress = 0.5 (disruption zone)', () => {
    expect(() => createDisruptedBarrierParticleLayer([mockBarrierHigh], 0.5, 11)).not.toThrow()
  })

  it('does not throw at progress = 0.99', () => {
    expect(() => createDisruptedBarrierParticleLayer([mockBarrierHigh], 0.99, 11)).not.toThrow()
  })

  it('does not throw at low zoom', () => {
    expect(() => createDisruptedBarrierParticleLayer([mockBarrierHigh], 0.3, 9)).not.toThrow()
  })

  it('does not throw at high zoom', () => {
    expect(() => createDisruptedBarrierParticleLayer([mockBarrierHigh], 0.3, 15)).not.toThrow()
  })

  it('handles multiple barriers without throwing', () => {
    expect(() =>
      createDisruptedBarrierParticleLayer([mockBarrierHigh, mockBarrierLow], 0.3, 11),
    ).not.toThrow()
  })

  it('handles a barrier with null type without throwing', () => {
    expect(() => createDisruptedBarrierParticleLayer([mockBarrierLow], 0.3, 11)).not.toThrow()
  })

})
