import { ArcLayer } from '@deck.gl/layers'
import type { ODFlow } from '../hooks/useFlowData'

const MIN_WIDTH = 1
const MAX_WIDTH = 8
const MAX_VOLUME = 5000

function getWidth(volume: number): number {
  const ratio = Math.min(volume / MAX_VOLUME, 1)
  return MIN_WIDTH + ratio * (MAX_WIDTH - MIN_WIDTH)
}

export function createODFlowLayer(flows: ODFlow[]): ArcLayer<ODFlow> {
  return new ArcLayer<ODFlow>({
    id: 'od-flows',
    data: flows,
    pickable: false,
    getSourcePosition: (flow) => flow.sourceCoord,
    getTargetPosition: (flow) => flow.targetCoord,
    getSourceColor: [0, 188, 212, 120],
    getTargetColor: [0, 188, 212, 30],
    getWidth: (flow) => getWidth(flow.volume),
    widthUnits: 'pixels',
    updateTriggers: {
      getWidth: flows,
    },
  })
}
