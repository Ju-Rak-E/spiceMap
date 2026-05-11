import { PathLayer } from '@deck.gl/layers'
import type { PickingInfo } from '@deck.gl/core'
import type { Barrier } from '../hooks/useBarriers'

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

function fitRouteTemplateToBarrier(
  template: [number, number][],
  barrier: Barrier,
): [number, number][] | null {
  if (template.length < 2) return null

  const [templateStartLng, templateStartLat] = template[0]
  const [templateEndLng, templateEndLat] = template[template.length - 1]
  const templateDx = templateEndLng - templateStartLng
  const templateDy = templateEndLat - templateStartLat
  const templateLenSq = templateDx * templateDx + templateDy * templateDy
  if (templateLenSq <= Number.EPSILON) return null

  const [sourceLng, sourceLat] = barrier.sourceCoord
  const [targetLng, targetLat] = barrier.targetCoord
  const barrierDx = targetLng - sourceLng
  const barrierDy = targetLat - sourceLat
  const barrierLen = Math.hypot(barrierDx, barrierDy)
  const templateLen = Math.sqrt(templateLenSq)
  if (barrierLen <= Number.EPSILON || templateLen <= Number.EPSILON) return null

  const templatePerpX = -templateDy / templateLen
  const templatePerpY = templateDx / templateLen
  const barrierPerpX = -barrierDy / barrierLen
  const barrierPerpY = barrierDx / barrierLen
  const offsetScale = Math.min(barrierLen / templateLen, 1.2)

  return template.map(([lng, lat]) => {
    const relX = lng - templateStartLng
    const relY = lat - templateStartLat
    const along = (relX * templateDx + relY * templateDy) / templateLenSq
    const lateral = (relX * templatePerpX + relY * templatePerpY) * offsetScale
    return [
      sourceLng + barrierDx * along + barrierPerpX * lateral,
      sourceLat + barrierDy * along + barrierPerpY * lateral,
    ] as [number, number]
  })
}

export function getBarrierRoutePath(
  barrier: Barrier,
  routes: BarrierRoutePathMap,
): [number, number][] | null {
  const matched = routes.get(barrier.id)
    ?? routes.get(`${barrier.sourceId}-${barrier.targetId}`)
  if (matched && matched.length >= 2) return matched

  const template = routes.values().next().value
  if (!template) return null
  return fitRouteTemplateToBarrier(template, barrier)
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
