import { PathLayer } from '@deck.gl/layers'
import type { PickingInfo } from '@deck.gl/core'
import { PathStyleExtension } from '@deck.gl/extensions'
import type { Barrier } from '../hooks/useBarriers'
import { getControlPoint, quadBezier } from '../utils/flowBezier'

const SEGMENTS = 32
const MIN_WIDTH = 1.5
const MAX_WIDTH = 5
const MAX_VOLUME = 10000

const SEVERITY_COLOR: Record<Barrier['severity'], [number, number, number, number]> = {
  high: [239, 83, 80, 220],
  medium: [255, 167, 38, 200],
  low: [255, 213, 79, 180],
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
    capRounded: true,
    jointRounded: true,
    // @ts-expect-error PathStyleExtension dash props are supported at runtime but absent from this deck.gl type.
    getDashArray: () => [6, 4],
    dashJustified: true,
    extensions: [new PathStyleExtension({ dash: true })],
    onHover,
    updateTriggers: {
      getColor: barriers,
      getWidth: barriers,
    },
  })
}
