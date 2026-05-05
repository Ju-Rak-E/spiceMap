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

const mockBarrierMedium: Barrier = {
  id: 'b3',
  sourceId: 'GC_CHEONGDAM',
  targetId: 'GC_SINSA',
  sourceName: '청담동',
  targetName: '신사동',
  sourceCoord: [127.047, 37.524],
  targetCoord: [127.020, 37.526],
  affectedVolume: 3000,
  score: 0.55,
  severity: 'medium',
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

  it('samples particles from the supplied road route path', () => {
    const routePath: [number, number][] = [
      mockBarrierHigh.sourceCoord,
      [126.98, 37.49],
      mockBarrierHigh.targetCoord,
    ]
    const layer = createDisruptedBarrierParticleLayer(
      [mockBarrierHigh],
      0,
      11,
      new Map([[mockBarrierHigh.id, routePath]]),
    )
    const data = layer.props.data as Array<{ position: [number, number] }>

    expect(data).toHaveLength(SEVERITY_PARTICLE_COUNT.high)
    expect(data[0].position).toEqual(routePath[0])
  })

  it('does not emit particles when route paths are absent', () => {
    const layer = createDisruptedBarrierParticleLayer([mockBarrierHigh], 0, 11, new Map())
    const data = layer.props.data as Array<{ position: [number, number] }>

    expect(data).toHaveLength(0)
  })

  it('samples particles from fitted mock route templates when route ids do not match', () => {
    const routePath: [number, number][] = [
      [126.7, 37.3],
      [126.75, 37.36],
      [126.82, 37.34],
      [126.9, 37.4],
    ]
    const layer = createDisruptedBarrierParticleLayer(
      [mockBarrierHigh],
      0,
      11,
      new Map([['mock-only', routePath]]),
    )
    const data = layer.props.data as Array<{ position: [number, number] }>

    expect(data).toHaveLength(SEVERITY_PARTICLE_COUNT.high)
    expect(data[0].position).toEqual(mockBarrierHigh.sourceCoord)
  })

  it('emits exactly the medium severity particle count from a matched route', () => {
    const routePath: [number, number][] = [
      mockBarrierMedium.sourceCoord,
      [127.033, 37.525],
      mockBarrierMedium.targetCoord,
    ]
    const layer = createDisruptedBarrierParticleLayer(
      [mockBarrierMedium],
      0,
      11,
      new Map([[mockBarrierMedium.id, routePath]]),
    )
    const data = layer.props.data as Array<unknown>

    expect(data).toHaveLength(SEVERITY_PARTICLE_COUNT.medium)
  })

  it('wraps progress > 1 to its modulo equivalent (1.5 ≡ 0.5)', () => {
    const routePath: [number, number][] = [
      mockBarrierHigh.sourceCoord,
      mockBarrierHigh.targetCoord,
    ]
    const routes = new Map([[mockBarrierHigh.id, routePath]])

    const half = createDisruptedBarrierParticleLayer([mockBarrierHigh], 0.5, 11, routes)
    const wrap = createDisruptedBarrierParticleLayer([mockBarrierHigh], 1.5, 11, routes)
    const halfData = half.props.data as Array<{ position: [number, number] }>
    const wrapData = wrap.props.data as Array<{ position: [number, number] }>

    expect(wrapData).toHaveLength(halfData.length)
    halfData.forEach((p, i) => {
      expect(wrapData[i].position[0]).toBeCloseTo(p.position[0])
      expect(wrapData[i].position[1]).toBeCloseTo(p.position[1])
    })
  })
})
