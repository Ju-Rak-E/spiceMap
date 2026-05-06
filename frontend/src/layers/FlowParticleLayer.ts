import { ScatterplotLayer } from '@deck.gl/layers'
import type { ODFlow } from '../hooks/useFlowData'
import { getAnimatedParticleCount } from '../utils/flowAnimation'
import { getControlPoint, quadBezier, PURPOSE_COLORS } from '../utils/flowBezier'
import { clamp } from '../utils/math'

const BASE_RADIUS = 200
const MAX_EXTRA_RADIUS = 500
const MAX_VOLUME = 10000
const MIN_ZOOM = 9
const FULL_SIZE_ZOOM = 14.5
const MIN_ZOOM_RADIUS_SCALE = 0.38
const MAX_ZOOM_RADIUS_SCALE = 1

interface Particle {
  position: [number, number]
  color: [number, number, number, number]
  radius: number
}

interface FlowParticleAnimation {
  zoom: number
  flowStrength: number
}

export function getZoomParticleRadiusScale(zoom: number): number {
  const progress = clamp((zoom - MIN_ZOOM) / (FULL_SIZE_ZOOM - MIN_ZOOM), 0, 1)
  return MIN_ZOOM_RADIUS_SCALE + progress * (MAX_ZOOM_RADIUS_SCALE - MIN_ZOOM_RADIUS_SCALE)
}

export function getFlowParticleRadius(
  volume: number,
  animation: FlowParticleAnimation,
): number {
  const ratio = Math.min(volume / MAX_VOLUME, 1) ** 0.6
  return (BASE_RADIUS + ratio * MAX_EXTRA_RADIUS) * getZoomParticleRadiusScale(animation.zoom)
}

export function getFlowParticlePixelBounds(zoom: number): { min: number; max: number } {
  const scale = getZoomParticleRadiusScale(zoom)
  return {
    min: 1.5 + scale * 1.5,
    max: 6 + scale * 8,
  }
}

export function getFlowParticleCount(
  volume: number,
  animation: FlowParticleAnimation,
): number {
  const ratio = Math.min(volume / MAX_VOLUME, 1)
  const baseCount = Math.max(1, Math.round(ratio * 2) + 1)
  return getAnimatedParticleCount(baseCount, animation.zoom, animation.flowStrength)
}

function generateParticles(
  flows: ODFlow[],
  progress: number,
  selectedNodeId: string | null,
  animation: FlowParticleAnimation,
): Particle[] {
  return flows.flatMap((flow) => {
    const isRelated =
      selectedNodeId === null ||
      flow.sourceId === selectedNodeId ||
      flow.targetId === selectedNodeId
    if (!isRelated) return []

    const ctrl = getControlPoint(flow.sourceCoord, flow.targetCoord)
    const radius = getFlowParticleRadius(flow.volume, animation)
    const count = getFlowParticleCount(flow.volume, animation)
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
  selectedNodeId: string | null = null,
  animation: FlowParticleAnimation = { zoom: 11, flowStrength: 3 },
): ScatterplotLayer<Particle> {
  const particles = generateParticles(flows, progress, selectedNodeId, animation)
  const pixelBounds = getFlowParticlePixelBounds(animation.zoom)
  return new ScatterplotLayer<Particle>({
    id: 'flow-particles',
    data: particles,
    pickable: false,
    getPosition: (p) => p.position,
    getRadius: (p) => p.radius,
    getFillColor: (p) => p.color,
    radiusUnits: 'meters',
    radiusMinPixels: pixelBounds.min,
    radiusMaxPixels: pixelBounds.max,
    updateTriggers: {
      getFillColor: [progress, selectedNodeId, animation.zoom, animation.flowStrength],
      getPosition: [progress, selectedNodeId, animation.zoom, animation.flowStrength],
      getRadius: [progress, selectedNodeId, animation.zoom, animation.flowStrength],
    },
  })
}
