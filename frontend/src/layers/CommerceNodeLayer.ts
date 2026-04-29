import { ScatterplotLayer } from '@deck.gl/layers'
import type { PickingInfo } from '@deck.gl/core'
import type { CommerceNode } from '../types/commerce'
import { deriveStartupSummary } from '../utils/startupAdvisor'
import { hexToRgba } from '../utils/colorUtils'

const MAX_CANDIDATES = 50
const MIN_CANDIDATE_RADIUS = 8
const MAX_CANDIDATE_RADIUS = 16
const CONTEXT_RADIUS = 6
const CANDIDATE_SELECTED_ALPHA = 255
const RECOMMENDED_ALPHA = 230
const CAUTION_ALPHA = 200
const NOT_RECOMMENDED_ALPHA = 170
const CONTEXT_ALPHA = 105
const SELECTED_MARKER_RADIUS = 24

function getCandidateRadius(node: CommerceNode, isSelected: boolean): number {
  if (isSelected) return SELECTED_MARKER_RADIUS
  const { fitScore } = deriveStartupSummary(node)
  return MIN_CANDIDATE_RADIUS + (fitScore / 100) * (MAX_CANDIDATE_RADIUS - MIN_CANDIDATE_RADIUS)
}

function getCandidateAlpha(node: CommerceNode): number {
  const { fitLevel } = deriveStartupSummary(node)
  if (fitLevel === 'recommended') return RECOMMENDED_ALPHA
  if (fitLevel === 'caution') return CAUTION_ALPHA
  return NOT_RECOMMENDED_ALPHA
}

export function getCandidateFillColor(
  node: CommerceNode,
  isSelected: boolean,
): [number, number, number, number] {
  const fill = deriveStartupSummary(node).fitColor
  const alpha = isSelected ? CANDIDATE_SELECTED_ALPHA : getCandidateAlpha(node)
  return hexToRgba(fill, alpha)
}

export function getContextFillColor(
  node: CommerceNode,
): [number, number, number, number] {
  const fill = deriveStartupSummary(node).fitColor
  return hexToRgba(fill, CONTEXT_ALPHA)
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
    .filter((node) => deriveStartupSummary(node).fitLevel !== 'unknown')
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
    getFillColor: (node) => getContextFillColor(node),
    radiusUnits: 'pixels',
    updateTriggers: {
      getPosition: contextNodes,
      getFillColor: contextNodes,
    },
  })

  const candidateLayer = new ScatterplotLayer<CommerceNode>({
    id: 'commerce-nodes-candidates',
    data: candidateNodes,
    pickable: true,
    stroked: true,
    getPosition: (node) => node.coordinates,
    getRadius: (node) => getCandidateRadius(node, node.id === selectedId),
    getFillColor: (node) => getCandidateFillColor(node, node.id === selectedId),
    getLineColor: (node) =>
      node.id === selectedId ? [255, 255, 255, 255] : [255, 255, 255, 150],
    getLineWidth: (node) =>
      node.id === selectedId ? 4 : 1.5,
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
    getFillColor: (node) => getCandidateFillColor(node, node.id === selectedId),
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
