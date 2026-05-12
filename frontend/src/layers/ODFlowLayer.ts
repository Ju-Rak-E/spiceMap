import { PathLayer } from '@deck.gl/layers'
import type { PickingInfo } from '@deck.gl/core'
import type { ODFlow } from '../hooks/useFlowData'
import { getControlPoint, quadBezier, PURPOSE_COLORS } from '../utils/flowBezier'

const SEGMENTS = 32
const MIN_WIDTH = 1.5
const MAX_UNSELECTED_WIDTH = 8
const FLOW_OVERLAY_PARAMETERS = {
  depthCompare: 'always',
  depthWriteEnabled: false,
} as const

// selectedId는 CommerceNode.admKey (행정동 코드) — flow.sourceId/targetId(adm_cd)와 매칭.
// 매칭 안 되는 경우 graceful: 강조 없이 기본 alpha 유지.
export function getFlowAlpha(flow: ODFlow, selectedId: string | null): number {
  if (selectedId === null) return 140
  if (flow.sourceId === selectedId || flow.targetId === selectedId) return 200
  return 20
}

// maxVolume: 현재 렌더링 중인 flows 중 최대값. 단일 목적 선택 등으로
// 절대값이 작아져도 라인이 사라지지 않도록 상대 정규화.
export function getFlowWidth(
  volume: number,
  maxVolume: number,
  selectedId: string | null,
  flow: ODFlow,
): number {
  const denom = Math.max(maxVolume, 1)
  const ratio = Math.min(volume / denom, 1)
  const base = MIN_WIDTH + ratio * (MAX_UNSELECTED_WIDTH - MIN_WIDTH)
  if (selectedId !== null && (flow.sourceId === selectedId || flow.targetId === selectedId)) {
    return Math.min(base * 1.5, MAX_UNSELECTED_WIDTH * 1.5)
  }
  return base
}

export interface FlowPath {
  flow: ODFlow
  path: [number, number][]
  color: [number, number, number, number]
  width: number
}

function buildFlowPath(flow: ODFlow, maxVolume: number, selectedId: string | null): FlowPath {
  const ctrl = getControlPoint(flow.sourceCoord, flow.targetCoord)
  const path = Array.from({ length: SEGMENTS + 1 }, (_, i) =>
    quadBezier(flow.sourceCoord, ctrl, flow.targetCoord, i / SEGMENTS),
  )
  const [r, g, b] = PURPOSE_COLORS[flow.purpose]
  return {
    flow,
    path,
    color: [r, g, b, getFlowAlpha(flow, selectedId)],
    width: getFlowWidth(flow.volume, maxVolume, selectedId, flow),
  }
}

export function createODFlowLayer(
  flows: ODFlow[],
  selectedNodeId: string | null = null,
  onHover?: (info: PickingInfo<FlowPath>) => void,
): PathLayer<FlowPath> {
  const maxVolume = flows.reduce((acc, f) => Math.max(acc, f.volume), 0)
  const paths = flows.map(f => buildFlowPath(f, maxVolume, selectedNodeId))
  return new PathLayer<FlowPath>({
    id: 'od-flows',
    data: paths,
    pickable: Boolean(onHover),
    getPath: (p) => p.path,
    getColor: (p) => p.color,
    getWidth: (p) => p.width,
    widthUnits: 'pixels',
    capRounded: true,
    jointRounded: true,
    parameters: FLOW_OVERLAY_PARAMETERS,
    onHover,
    updateTriggers: {
      getColor: [flows, selectedNodeId],
      getWidth: [flows, selectedNodeId],
    },
  })
}
