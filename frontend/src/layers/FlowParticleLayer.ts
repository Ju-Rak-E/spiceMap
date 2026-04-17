import { ScatterplotLayer } from '@deck.gl/layers'
import type { ODFlow } from '../hooks/useFlowData'
import { getControlPoint, quadBezier, PURPOSE_COLORS } from '../utils/flowBezier'

const BASE_RADIUS = 200
const MAX_EXTRA_RADIUS = 500
const MAX_VOLUME = 10000

interface Particle {
  position: [number, number]
  color: [number, number, number, number]
  radius: number
}

function getParticleRadius(volume: number): number {
  const ratio = Math.min(volume / MAX_VOLUME, 1) ** 0.6
  return BASE_RADIUS + ratio * MAX_EXTRA_RADIUS
}

// 이동량 비율에 따라 파티클 수 1~4개
function getParticleCount(volume: number): number {
  const ratio = Math.min(volume / MAX_VOLUME, 1)
  return Math.max(1, Math.round(ratio * 3) + 1)
}

function generateParticles(flows: ODFlow[], progress: number): Particle[] {
  return flows.flatMap((flow) => {
    const ctrl = getControlPoint(flow.sourceCoord, flow.targetCoord)
    const radius = getParticleRadius(flow.volume)
    const count = getParticleCount(flow.volume)
    const [r, g, b] = PURPOSE_COLORS[flow.purpose]
    return Array.from({ length: count }, (_, i) => {
      const t = (progress + i / count) % 1
      const alpha = Math.round(Math.sin(t * Math.PI) * 200 + 55)
      return {
        position: quadBezier(flow.sourceCoord, ctrl, flow.targetCoord, t),
        color: [r, g, b, alpha] as [number, number, number, number],
        radius,
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
    getRadius: (p) => p.radius,
    getFillColor: (p) => p.color,
    radiusUnits: 'meters',
    radiusMinPixels: 3,
    radiusMaxPixels: 14,
    updateTriggers: {
      getFillColor: progress,
      getPosition: progress,
      getRadius: progress,
    },
  })
}
