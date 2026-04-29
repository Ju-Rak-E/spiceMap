import { PathLayer } from '@deck.gl/layers'
import type { ODFlow } from '../hooks/useFlowData'
import { getControlPoint, quadBezier, PURPOSE_COLORS } from '../utils/flowBezier'

const SEGMENTS = 32
const MIN_WIDTH = 1.5
const MAX_UNSELECTED_WIDTH = 8
const MAX_VOLUME = 10000

// NOTE: sourceId/targetId are admin-district codes. Highlighting activates when
// Dev-A adds originCommCd/destCommCd to the OD flow API response.
export function getFlowAlpha(flow: ODFlow, selectedId: string | null): number {
  if (selectedId === null) return 140
  if (flow.sourceId === selectedId || flow.targetId === selectedId) return 200
  return 20
}

export function getFlowWidth(volume: number, selectedId: string | null, flow: ODFlow): number {
  const ratio = Math.min(volume / MAX_VOLUME, 1)
  const base = MIN_WIDTH + ratio * (MAX_UNSELECTED_WIDTH - MIN_WIDTH)
  if (selectedId !== null && (flow.sourceId === selectedId || flow.targetId === selectedId)) {
    return Math.min(base * 1.5, MAX_UNSELECTED_WIDTH * 1.5)
  }
  return base
}

interface FlowPath {
  path: [number, number][]
  color: [number, number, number, number]
  width: number
}

function buildFlowPath(flow: ODFlow, selectedId: string | null): FlowPath {
  const ctrl = getControlPoint(flow.sourceCoord, flow.targetCoord)
  const path = Array.from({ length: SEGMENTS + 1 }, (_, i) =>
    quadBezier(flow.sourceCoord, ctrl, flow.targetCoord, i / SEGMENTS),
  )
  const [r, g, b] = PURPOSE_COLORS[flow.purpose]
  return {
    path,
    color: [r, g, b, getFlowAlpha(flow, selectedId)],
    width: getFlowWidth(flow.volume, selectedId, flow),
  }
}

export function createODFlowLayer(
  flows: ODFlow[],
  selectedNodeId: string | null = null,
): PathLayer<FlowPath> {
  const paths = flows.map(f => buildFlowPath(f, selectedNodeId))
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
      getColor: [flows, selectedNodeId],
      getWidth: [flows, selectedNodeId],
    },
  })
}
