import { ScatterplotLayer } from '@deck.gl/layers'
import type { PickingInfo } from '@deck.gl/core'
import { COMMERCE_COLORS } from '../styles/tokens'
import type { CommerceNode } from '../types/commerce'

const MIN_RADIUS = 300   // 최소 반경(m)
const MAX_RADIUS = 1500  // 최대 반경(m)
const MAX_ABS_FLOW = 1200

/** hex '#RRGGBB' → [R, G, B] */
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function getRadius(netFlow: number): number {
  const ratio = Math.min(Math.abs(netFlow) / MAX_ABS_FLOW, 1)
  return MIN_RADIUS + ratio * (MAX_RADIUS - MIN_RADIUS)
}

function getColor(node: CommerceNode, isHighlight: boolean): [number, number, number, number] {
  const colorToken = COMMERCE_COLORS[node.type]
  const [r, g, b] = hexToRgb(colorToken.fill)
  return isHighlight ? [r, g, b, 255] : [r, g, b, 200]
}

function getTop10PercentThreshold(nodes: CommerceNode[]): number {
  if (nodes.length === 0) return 1
  const sorted = [...nodes].sort((a, b) => a.degreeCentrality - b.degreeCentrality)
  return sorted[Math.floor(sorted.length * 0.9)]?.degreeCentrality ?? 1
}

export function createCommerceNodeLayer(
  nodes: CommerceNode[],
  onHover: (info: PickingInfo<CommerceNode>) => void,
  onClick?: (info: PickingInfo<CommerceNode>) => void,
): ScatterplotLayer<CommerceNode> {
  const threshold = getTop10PercentThreshold(nodes)

  return new ScatterplotLayer<CommerceNode>({
    id: 'commerce-nodes',
    data: nodes,
    pickable: true,
    stroked: true,
    getPosition: (node) => node.coordinates,
    getRadius: (node) => getRadius(node.netFlow),
    getFillColor: (node) => getColor(node, node.degreeCentrality >= threshold),
    getLineColor: (node) =>
      node.degreeCentrality >= threshold ? [255, 255, 255, 220] : [255, 255, 255, 80],
    getLineWidth: (node) => (node.degreeCentrality >= threshold ? 60 : 20),
    radiusUnits: 'meters',
    lineWidthUnits: 'meters',
    onHover,
    onClick,
    updateTriggers: {
      getRadius: nodes,
      getFillColor: nodes,
      getLineColor: nodes,
      getLineWidth: nodes,
    },
  })
}
