import { PathLayer } from '@deck.gl/layers'
import type { ODFlow } from '../hooks/useFlowData'
import { getControlPoint, quadBezier, PURPOSE_COLORS } from '../utils/flowBezier'

const SEGMENTS = 32
const MIN_WIDTH = 1.5
const MAX_WIDTH = 8
const MAX_VOLUME = 10000

interface FlowPath {
  path: [number, number][]
  color: [number, number, number, number]
  width: number
}

function buildFlowPath(flow: ODFlow): FlowPath {
  const ctrl = getControlPoint(flow.sourceCoord, flow.targetCoord)
  const path = Array.from({ length: SEGMENTS + 1 }, (_, i) =>
    quadBezier(flow.sourceCoord, ctrl, flow.targetCoord, i / SEGMENTS),
  )
  const ratio = Math.min(flow.volume / MAX_VOLUME, 1)
  const width = MIN_WIDTH + ratio * (MAX_WIDTH - MIN_WIDTH)
  const [r, g, b] = PURPOSE_COLORS[flow.purpose]
  return { path, color: [r, g, b, 140], width }
}

export function createODFlowLayer(flows: ODFlow[]): PathLayer<FlowPath> {
  const paths = flows.map(buildFlowPath)
  return new PathLayer<FlowPath>({
    id: 'od-flows',
    data: paths,
    pickable: false,
    getPath: (p) => p.path,
    getColor: (p) => p.color,
    getWidth: (p) => p.width,
    widthUnits: 'pixels',
    capRounded: true,
    jointRounded: true,
    updateTriggers: {
      getColor: flows,
      getWidth: flows,
    },
  })
}
