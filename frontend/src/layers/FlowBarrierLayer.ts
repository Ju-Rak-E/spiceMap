import { PathLayer } from '@deck.gl/layers'
import type { PickingInfo } from '@deck.gl/core'
import type { Barrier } from '../hooks/useBarriers'
import { buildNavRouteWaypoints } from '../utils/barrierRouteAnimation'

const MIN_WIDTH = 5
const MAX_WIDTH = 12
const MAX_VOLUME = 10000

const SEVERITY_COLOR: Record<Barrier['severity'], [number, number, number, number]> = {
  high: [255, 82, 82, 230],
  medium: [244, 114, 182, 220],
  low: [192, 132, 252, 210],
}

const ROUTE_CASING_COLOR: [number, number, number, number] = [8, 13, 20, 220]
const ROUTE_OVERLAY_PARAMETERS = {
  depthCompare: 'always',
  depthWriteEnabled: false,
} as const

interface BarrierPath {
  barrier: Barrier
  path: [number, number][]
  color: [number, number, number, number]
  width: number
}

export type BarrierRoutePathMap = ReadonlyMap<string, [number, number][]>

export function getBarrierWidth(volume: number): number {
  const ratio = Math.min(volume / MAX_VOLUME, 1)
  return MIN_WIDTH + ratio * (MAX_WIDTH - MIN_WIDTH)
}

// Minimum lateral deviation (degrees) for a path to be considered curved.
// ORS road-following routes for inter-district barriers deviate far more than this.
// Paths below this threshold are treated as straight and replaced with nav waypoints.
const MIN_CURVE_DEVIATION_DEG = 0.001

function hasUsableSpan(start: [number, number], end: [number, number]): boolean {
  const dx = end[0] - start[0]
  const dy = end[1] - start[1]
  return dx * dx + dy * dy > 1e-12
}

function isPathEffectivelyStraight(path: [number, number][]): boolean {
  if (path.length <= 2) return true
  const [x0, y0] = path[0]
  const [xn, yn] = path[path.length - 1]
  const dx = xn - x0
  const dy = yn - y0
  const len = Math.hypot(dx, dy)
  if (len < 1e-10) return true
  for (let i = 1; i < path.length - 1; i++) {
    const px = path[i][0] - x0
    const py = path[i][1] - y0
    if (Math.abs(px * dy - py * dx) / len > MIN_CURVE_DEVIATION_DEG) return false
  }
  return true
}

function buildNavigationFallbackPath(barrier: Barrier): [number, number][] | null {
  if (!hasUsableSpan(barrier.sourceCoord, barrier.targetCoord)) return null
  return buildNavRouteWaypoints(barrier.sourceCoord, barrier.targetCoord)
}

export function getBarrierRoutePath(
  barrier: Barrier,
  routes: BarrierRoutePathMap,
): [number, number][] | null {
  const matched = routes.get(barrier.id)
    ?? routes.get(`${barrier.sourceId}-${barrier.targetId}`)
  if (matched && matched.length >= 2) {
    if (matched.length === 2 || isPathEffectivelyStraight(matched)) {
      return buildNavigationFallbackPath(barrier)
    }
    return matched
  }
  if (!routes.size) return null
  return buildNavigationFallbackPath(barrier)
}

function buildBarrierPath(barrier: Barrier, routes: BarrierRoutePathMap): BarrierPath | null {
  const path = getBarrierRoutePath(barrier, routes)
  if (!path || path.length < 2) return null
  return {
    barrier,
    path,
    color: SEVERITY_COLOR[barrier.severity],
    width: getBarrierWidth(barrier.affectedVolume),
  }
}

export function createFlowBarrierLayer(
  barriers: Barrier[],
  routes: BarrierRoutePathMap,
  onHover?: (info: PickingInfo<BarrierPath>) => void,
): PathLayer<BarrierPath> {
  const paths = barriers
    .map((barrier) => buildBarrierPath(barrier, routes))
    .filter((path): path is BarrierPath => path !== null)
  return new PathLayer<BarrierPath>({
    id: 'flow-barriers',
    data: paths,
    pickable: Boolean(onHover),
    getPath: (p) => p.path,
    getColor: (p) => p.color,
    getWidth: (p) => p.width,
    widthUnits: 'pixels',
    widthMinPixels: MIN_WIDTH,
    capRounded: true,
    jointRounded: true,
    parameters: ROUTE_OVERLAY_PARAMETERS,
    onHover,
    updateTriggers: {
      getColor: barriers,
      getWidth: barriers,
    },
  })
}

export function createFlowBarrierLayers(
  barriers: Barrier[],
  routes: BarrierRoutePathMap,
  onHover?: (info: PickingInfo<BarrierPath>) => void,
): PathLayer<BarrierPath>[] {
  const routeLayer = createFlowBarrierLayer(barriers, routes, onHover)
  const paths = routeLayer.props.data as BarrierPath[]
  const casingLayer = new PathLayer<BarrierPath>({
    id: 'flow-barriers-casing',
    data: paths,
    pickable: false,
    getPath: (p) => p.path,
    getColor: ROUTE_CASING_COLOR,
    getWidth: (p) => p.width + 4,
    widthUnits: 'pixels',
    widthMinPixels: MIN_WIDTH + 4,
    capRounded: true,
    jointRounded: true,
    parameters: ROUTE_OVERLAY_PARAMETERS,
  })

  return [
    casingLayer,
    routeLayer.clone({ id: 'flow-barriers-route' }),
  ]
}
