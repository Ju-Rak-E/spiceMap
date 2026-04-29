import { ScatterplotLayer } from '@deck.gl/layers'
import type { PickingInfo } from '@deck.gl/core'
import { COMMERCE_COLORS } from '../styles/tokens'
import type { CommerceNode } from '../types/commerce'

const MIN_RADIUS = 300
const MAX_RADIUS = 1500
const MAX_ABS_FLOW = 1200

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

export function getGriBorderColor(
  griScore: number,
  isSelected: boolean,
): [number, number, number, number] {
  if (isSelected) return [236, 239, 241, 255]
  if (griScore >= 70) return [239, 83, 80, 255]
  if (griScore >= 40) return [255, 167, 38, 255]
  return [236, 239, 241, 80]
}

export function getGriBorderWidth(griScore: number, isSelected: boolean): number {
  if (isSelected) return 90
  if (griScore >= 70) return 90
  if (griScore >= 40) return 60
  return 20
}

export function createCommerceNodeLayer(
  nodes: CommerceNode[],
  onHover: (info: PickingInfo<CommerceNode>) => void,
  onClick: (info: PickingInfo<CommerceNode>) => void,
  selectedId: string | null,
): ScatterplotLayer<CommerceNode> {
  return new ScatterplotLayer<CommerceNode>({
    id: 'commerce-nodes',
    data: nodes,
    pickable: true,
    stroked: true,
    getPosition: (node) => node.coordinates,
    getRadius: (node) => getRadius(node.netFlow),
    getFillColor: (node) => getColor(node, node.id === selectedId),
    getLineColor: (node) =>
      getGriBorderColor(node.griScore, node.id === selectedId),
    getLineWidth: (node) =>
      getGriBorderWidth(node.griScore, node.id === selectedId),
    radiusUnits: 'meters',
    lineWidthUnits: 'meters',
    onHover,
    onClick,
    updateTriggers: {
      getRadius: nodes,
      getFillColor: [nodes, selectedId],
      getLineColor: [nodes, selectedId],
      getLineWidth: [nodes, selectedId],
    },
  })
}
