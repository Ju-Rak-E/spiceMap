import { PathLayer } from '@deck.gl/layers'
import type { PickingInfo } from '@deck.gl/core'
import { PathStyleExtension } from '@deck.gl/extensions'
import type { Barrier } from '../hooks/useBarriers'

const MIN_WIDTH = 4
const MAX_WIDTH = 9
const MAX_VOLUME = 10000

const SEVERITY_COLOR: Record<Barrier['severity'], [number, number, number, number]> = {
  high: [255, 82, 82, 255],
  medium: [255, 183, 77, 245],
  low: [255, 235, 59, 235],
}

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

function getRoutePath(barrier: Barrier, routes: BarrierRoutePathMap): [number, number][] | null {
  return routes.get(barrier.id)
    ?? routes.get(`${barrier.sourceId}-${barrier.targetId}`)
    ?? null
}

function buildBarrierPath(barrier: Barrier, routes: BarrierRoutePathMap): BarrierPath | null {
  const path = getRoutePath(barrier, routes)
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
    // @ts-expect-error PathStyleExtension dash props are supported at runtime but absent from this deck.gl type.
    getDashArray: () => [14, 6],
    dashJustified: true,
    extensions: [new PathStyleExtension({ dash: true })],
    onHover,
    updateTriggers: {
      getColor: barriers,
      getWidth: barriers,
    },
  })
}
