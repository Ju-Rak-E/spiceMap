import { PathLayer } from '@deck.gl/layers'
import type { PickingInfo } from '@deck.gl/core'
import { PathStyleExtension } from '@deck.gl/extensions'
import type { Barrier } from '../hooks/useBarriers'
import { getControlPoint, quadBezier } from '../utils/flowBezier'

const SEGMENTS = 32
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

export function getBarrierWidth(volume: number): number {
  const ratio = Math.min(volume / MAX_VOLUME, 1)
  return MIN_WIDTH + ratio * (MAX_WIDTH - MIN_WIDTH)
}

function buildBarrierPath(barrier: Barrier): BarrierPath {
  const ctrl = getControlPoint(barrier.sourceCoord, barrier.targetCoord)
  const path = Array.from({ length: SEGMENTS + 1 }, (_, i) =>
    quadBezier(barrier.sourceCoord, ctrl, barrier.targetCoord, i / SEGMENTS),
  )
  return {
    barrier,
    path,
    color: SEVERITY_COLOR[barrier.severity],
    width: getBarrierWidth(barrier.affectedVolume),
  }
}

export function createFlowBarrierLayer(
  barriers: Barrier[],
  onHover?: (info: PickingInfo<BarrierPath>) => void,
): PathLayer<BarrierPath> {
  const paths = barriers.map(buildBarrierPath)
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
