import { ScatterplotLayer } from '@deck.gl/layers'
import type { PickingInfo } from '@deck.gl/core'
import type { CommerceNode } from '../types/commerce'
import { deriveStartupSummary } from '../utils/startupAdvisor'
import { hexToRgba } from '../utils/colorUtils'
import { normalizeVisualScores, resolveVisualScore } from '../utils/visualScore'
import { COMMERCE_COLORS } from '../styles/tokens'

const MAX_CANDIDATES = 50
const MIN_CANDIDATE_RADIUS = 8
const MAX_CANDIDATE_RADIUS = 16
const CONTEXT_RADIUS = 6
const CANDIDATE_SELECTED_ALPHA = 255
const RECOMMENDED_ALPHA = 230
const CONTEXT_TYPE_ALPHA = 90
const SELECTED_MARKER_RADIUS = 24

export function getCandidateRadius(
  node: CommerceNode,
  isSelected: boolean,
  visualScores: ReadonlyMap<string, number> = new Map(),
): number {
  if (isSelected) return SELECTED_MARKER_RADIUS
  const visualScore = resolveVisualScore(node, visualScores)
  return MIN_CANDIDATE_RADIUS + (visualScore / 100) * (MAX_CANDIDATE_RADIUS - MIN_CANDIDATE_RADIUS)
}

function getCandidateAlpha(): number {
  return RECOMMENDED_ALPHA
}

export function getCandidateFillColor(
  node: CommerceNode,
  isSelected: boolean,
): [number, number, number, number] {
  const fill = COMMERCE_COLORS[node.type].fill
  const alpha = isSelected ? CANDIDATE_SELECTED_ALPHA : getCandidateAlpha()
  return hexToRgba(fill, alpha)
}

export function getContextFillColor(
  node: CommerceNode,
): [number, number, number, number] {
  const fill = COMMERCE_COLORS[node.type].fill
  return hexToRgba(fill, CONTEXT_TYPE_ALPHA)
}

export function getGriBorderColor(
  griScore: number,
  isSelected: boolean,
): [number, number, number, number] {
  if (isSelected) return [255, 255, 255, 255]
  if (griScore >= 70) return [239, 83, 80, 255]
  if (griScore >= 40) return [255, 167, 38, 255]
  return [236, 239, 241, 170]
}

export function getGriBorderWidth(griScore: number, isSelected: boolean): number {
  if (isSelected) return 4
  if (griScore >= 70) return 3
  if (griScore >= 40) return 2
  return 1
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
  const visualScores = normalizeVisualScores(candidateNodes)
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
    getRadius: (node) => getCandidateRadius(node, node.id === selectedId, visualScores),
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
      getRadius: [candidateNodes, selectedId, visualScores],
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
  const visualScores = normalizeVisualScores(candidateNodes)
  return new ScatterplotLayer<CommerceNode>({
    id: 'commerce-nodes-candidates',
    data: candidateNodes,
    pickable: true,
    stroked: true,
    getPosition: (node) => node.coordinates,
    getRadius: (node) => getCandidateRadius(node, node.id === selectedId, visualScores),
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
      getRadius: [candidateNodes, selectedId, visualScores],
      getFillColor: [candidateNodes, selectedId],
      getLineColor: [candidateNodes, selectedId],
      getLineWidth: [candidateNodes, selectedId],
    },
  })
}
