import { ScatterplotLayer } from '@deck.gl/layers'
import type { ODFlow } from '../hooks/useFlowData'

const PARTICLES_PER_FLOW = 3
const PARTICLE_RADIUS = 120  // meters

interface Particle {
  position: [number, number]
  alpha: number
}

function getControlPoint(
  src: [number, number],
  tgt: [number, number],
): [number, number] {
  const dist = Math.sqrt((tgt[0] - src[0]) ** 2 + (tgt[1] - src[1]) ** 2)
  return [
    (src[0] + tgt[0]) / 2,
    (src[1] + tgt[1]) / 2 + dist * 0.35,
  ]
}

function quadBezier(
  src: [number, number],
  ctrl: [number, number],
  tgt: [number, number],
  t: number,
): [number, number] {
  const u = 1 - t
  return [
    u * u * src[0] + 2 * u * t * ctrl[0] + t * t * tgt[0],
    u * u * src[1] + 2 * u * t * ctrl[1] + t * t * tgt[1],
  ]
}

function generateParticles(flows: ODFlow[], progress: number): Particle[] {
  return flows.flatMap((flow) => {
    const ctrl = getControlPoint(flow.sourceCoord, flow.targetCoord)
    return Array.from({ length: PARTICLES_PER_FLOW }, (_, i) => {
      const t = (progress + i / PARTICLES_PER_FLOW) % 1
      // 양 끝에서 페이드 인/아웃 (sin 곡선)
      const alpha = Math.round(Math.sin(t * Math.PI) * 200 + 55)
      return {
        position: quadBezier(flow.sourceCoord, ctrl, flow.targetCoord, t),
        alpha,
      }
    })
  })
}

export function createFlowParticleLayer(
  flows: ODFlow[],
  progress: number,
): ScatterplotLayer<Particle> {
  const particles = generateParticles(flows, progress)

  return new ScatterplotLayer<Particle>({
    id: 'flow-particles',
    data: particles,
    pickable: false,
    getPosition: (p) => p.position,
    getRadius: PARTICLE_RADIUS,
    getFillColor: (p) => [0, 229, 255, p.alpha],
    radiusUnits: 'meters',
    updateTriggers: {
      getFillColor: progress,
      getPosition: progress,
    },
  })
}
