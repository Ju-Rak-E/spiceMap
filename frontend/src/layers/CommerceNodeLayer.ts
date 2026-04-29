import { ScatterplotLayer } from '@deck.gl/layers'
import type { PickingInfo } from '@deck.gl/core'
import type { CommerceNode } from '../types/commerce'
import { deriveStartupSummary } from '../utils/startupAdvisor'

const MAX_CANDIDATES = 50
const MIN_CANDIDATE_RADIUS = 8
const MAX_CANDIDATE_RADIUS = 16
const CONTEXT_RADIUS = 4

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

function getCandidateRadius(node: CommerceNode, isSelected: boolean): number {
  if (isSelected) return 18
  const { fitScore } = deriveStartupSummary(node)
  return MIN_CANDIDATE_RADIUS + (fitScore / 100) * (MAX_CANDIDATE_RADIUS - MIN_CANDIDATE_RADIUS)
}

function getCandidateColor(node: CommerceNode, isSelected: boolean): [number, number, number, number] {
  const { fitColor } = deriveStartupSummary(node)
  const [r, g, b] = hexToRgb(fitColor)
  return isSelected ? [r, g, b, 255] : [r, g, b, 230]
}

export function getGriBorderColor(
  _griScore: number,
  isSelected: boolean,
): [number, number, number, number] {
  if (isSelected) return [123, 208, 141, 255]
  return [0, 0, 0, 0]
}

export function getGriBorderWidth(_griScore: number, isSelected: boolean): number {
  if (isSelected) return 3
  return 0
}

export function getCandidateNodes(nodes: CommerceNode[], selectedId: string | null): CommerceNode[] {
  const candidates = nodes
    .filter((node) => deriveStartupSummary(node).fitLevel === 'recommended')
    .sort((a, b) => deriveStartupSummary(b).fitScore - deriveStartupSummary(a).fitScore)
    .slice(0, MAX_CANDIDATES)

  const selected = selectedId ? nodes.find((node) => node.id === selectedId) : null
  if (selected && !candidates.some((node) => node.id === selected.id)) {
    return [selected, ...candidates]
  }

  return candidates
}

export function createCommerceNodeLayers(
  nodes: CommerceNode[],
  onHover: (info: PickingInfo<CommerceNode>) => void,
  onClick: (info: PickingInfo<CommerceNode>) => void,
  selectedId: string | null,
): ScatterplotLayer<CommerceNode>[] {
  const candidateNodes = getCandidateNodes(nodes, selectedId)
  const candidateIds = new Set(candidateNodes.map((node) => node.id))
  const contextNodes = nodes.filter((node) => !candidateIds.has(node.id))

  const contextLayer = new ScatterplotLayer<CommerceNode>({
    id: 'commerce-nodes-context',
    data: contextNodes,
    pickable: false,
    stroked: false,
    getPosition: (node) => node.coordinates,
    getRadius: CONTEXT_RADIUS,
    getFillColor: [92, 111, 128, 60],
    radiusUnits: 'pixels',
    updateTriggers: {
      getPosition: contextNodes,
    },
  })

  const candidateLayer = new ScatterplotLayer<CommerceNode>({
    id: 'commerce-nodes-candidates',
    data: candidateNodes,
    pickable: true,
    stroked: true,
    getPosition: (node) => node.coordinates,
    getRadius: (node) => getCandidateRadius(node, node.id === selectedId),
    getFillColor: (node) => getCandidateColor(node, node.id === selectedId),
    getLineColor: (node) =>
      node.id === selectedId ? getGriBorderColor(node.griScore, true) : [255, 255, 255, 150],
    getLineWidth: (node) =>
      node.id === selectedId ? getGriBorderWidth(node.griScore, true) : 1.5,
    radiusUnits: 'pixels',
    lineWidthUnits: 'pixels',
    onHover,
    onClick,
    updateTriggers: {
      getRadius: [candidateNodes, selectedId],
      getFillColor: [candidateNodes, selectedId],
      getLineColor: [candidateNodes, selectedId],
      getLineWidth: [candidateNodes, selectedId],
    },
  })

  return [contextLayer, candidateLayer]
}

export function createCommerceNodeLayer(
  nodes: CommerceNode[],
  onHover: (info: PickingInfo<CommerceNode>) => void,
  onClick: (info: PickingInfo<CommerceNode>) => void,
  selectedId: string | null,
): ScatterplotLayer<CommerceNode> {
  const candidateNodes = getCandidateNodes(nodes, selectedId)
  return new ScatterplotLayer<CommerceNode>({
    id: 'commerce-nodes-candidates',
    data: candidateNodes,
    pickable: true,
    stroked: true,
    getPosition: (node) => node.coordinates,
    getRadius: (node) => getCandidateRadius(node, node.id === selectedId),
    getFillColor: (node) => getCandidateColor(node, node.id === selectedId),
    getLineColor: (node) =>
      getGriBorderColor(node.griScore, node.id === selectedId),
    getLineWidth: (node) =>
      getGriBorderWidth(node.griScore, node.id === selectedId),
    radiusUnits: 'pixels',
    lineWidthUnits: 'pixels',
    onHover,
    onClick,
    updateTriggers: {
      getRadius: [candidateNodes, selectedId],
      getFillColor: [candidateNodes, selectedId],
      getLineColor: [candidateNodes, selectedId],
      getLineWidth: [candidateNodes, selectedId],
    },
  })
}
