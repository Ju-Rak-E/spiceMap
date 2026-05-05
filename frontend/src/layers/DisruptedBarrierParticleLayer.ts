import { ScatterplotLayer } from '@deck.gl/layers'
import type { Barrier, BarrierSeverity } from '../hooks/useBarriers'
import {
  samplePolyline,
  disruptionAlpha,
  disruptionScatter,
} from '../utils/barrierRouteAnimation'
import { clamp } from '../utils/math'
import { getBarrierRoutePath, type BarrierRoutePathMap } from './FlowBarrierLayer'

const BASE_RADIUS_M = 180
const MIN_ZOOM = 9
const FULL_SIZE_ZOOM = 14.5

export const SEVERITY_PARTICLE_COUNT: Record<BarrierSeverity, number> = {
  high: 4,
  medium: 3,
  low: 2,
}

export const SEVERITY_SCATTER_DEG: Record<BarrierSeverity, number> = {
  high: 0.005,    // ~555 m lateral at Seoul latitude
  medium: 0.003,  // ~333 m
  low: 0.0015,    // ~167 m
}

const SEVERITY_COLOR: Record<BarrierSeverity, [number, number, number]> = {
  high: [255, 82, 82],
  medium: [255, 183, 77],
  low: [255, 235, 59],
}

interface BarrierParticle {
  position: [number, number]
  color: [number, number, number, number]
  radius: number
}

export function getBarrierParticleRadiusScale(zoom: number): number {
  return clamp((zoom - MIN_ZOOM) / (FULL_SIZE_ZOOM - MIN_ZOOM), 0.3, 1)
}

function generateParticles(
  barriers: Barrier[],
  progress: number,
  zoom: number,
  routes: BarrierRoutePathMap,
): BarrierParticle[] {
  const radiusScale = getBarrierParticleRadiusScale(zoom)

  return barriers.flatMap((barrier) => {
    const routePath = getBarrierRoutePath(barrier, routes)
    if (!routePath || routePath.length < 2) return []
    const count = SEVERITY_PARTICLE_COUNT[barrier.severity]
    const scatterDeg = SEVERITY_SCATTER_DEG[barrier.severity]
    const [r, g, b] = SEVERITY_COLOR[barrier.severity]
    const radius = BASE_RADIUS_M * radiusScale * (1 + barrier.score * 0.4)

    return Array.from({ length: count }, (_, i) => {
      const seed = i / count
      const t = (progress + seed) % 1
      const basePos = samplePolyline(routePath, t)
      const alpha = disruptionAlpha(t)
      const [sx, sy] = disruptionScatter(t, seed, scatterDeg)
      return {
        position: [basePos[0] + sx, basePos[1] + sy] as [number, number],
        color: [r, g, b, Math.round(alpha * 210)] as [number, number, number, number],
        radius,
      }
    })
  })
}

export function createDisruptedBarrierParticleLayer(
  barriers: Barrier[],
  progress: number,
  zoom = 11,
  routes: BarrierRoutePathMap = new Map(),
): ScatterplotLayer<BarrierParticle> {
  const particles = generateParticles(barriers, progress, zoom, routes)
  return new ScatterplotLayer<BarrierParticle>({
    id: 'barrier-disrupted-particles',
    data: particles,
    pickable: false,
    getPosition: (p) => p.position,
    getRadius: (p) => p.radius,
    getFillColor: (p) => p.color,
    radiusUnits: 'meters',
    radiusMinPixels: 3,
    radiusMaxPixels: 14,
    updateTriggers: {
      getFillColor: [progress, zoom],
      getPosition: [progress, zoom],
      getRadius: [zoom],
    },
  })
}
