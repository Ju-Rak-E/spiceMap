import { clamp } from './math'

export const FLOW_PROGRESS_PER_MS = 0.00008
const MIN_FLOW_ZOOM = 9
const MAX_FLOW_ZOOM = 18
const MIN_DENSITY = 1
const MAX_DENSITY = 5

export function getZoomAnimationScale(zoom: number): number {
  const zoomProgress = clamp((zoom - MIN_FLOW_ZOOM) / (MAX_FLOW_ZOOM - MIN_FLOW_ZOOM), 0, 1)
  return 1 - zoomProgress * 0.45
}

export function getDensityAnimationScale(flowStrength: number): number {
  const density = clamp(Math.round(flowStrength), MIN_DENSITY, MAX_DENSITY)
  const densityProgress = (density - MIN_DENSITY) / (MAX_DENSITY - MIN_DENSITY)
  return 0.35 + densityProgress * 0.65
}

export function getAnimatedParticleCount(baseCount: number, zoom: number, flowStrength: number): number {
  const scaledCount = baseCount * getZoomAnimationScale(zoom) * getDensityAnimationScale(flowStrength)
  return clamp(Math.round(scaledCount), 1, 5)
}

export function getFlowProgressIncrement(deltaMs: number): number {
  return Math.max(0, deltaMs) * FLOW_PROGRESS_PER_MS
}
