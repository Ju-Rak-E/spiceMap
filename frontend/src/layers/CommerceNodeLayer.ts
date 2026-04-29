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
const CONTEXT_UNKNOWN_ALPHA = 38  // 분석 미보유(`fitLevel='unknown'`) 상권 — 매우 흐리게(15%)
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
  const summary = deriveStartupSummary(node)
  // 분석 미보유(`unknown`)는 화면 노이즈 줄이기 위해 추가로 흐리게.
  // strategy_d13.md §5: 회색 default 비율 ≤ 5% 목표.
  const alpha = summary.fitLevel === 'unknown' ? CONTEXT_UNKNOWN_ALPHA : CONTEXT_ALPHA
  return hexToRgba(summary.fitColor, alpha)
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

// docs/hero_shot_scenario.md §1-2: 강남·관악 zoom 11.5에서 신림(gw_001)을 항상 펄싱으로 강조.
// 1.5s 주기 SVG halo 효과를 ScatterplotLayer로 구현 (캔버스 내부 → MapLibre 줌 동기화 무료).
const HERO_PULSE_PERIOD_MS = 1500
const HERO_PULSE_BASE_RADIUS = 14
const HERO_PULSE_MAX_RADIUS = 34
const HERO_PULSE_COLOR: [number, number, number] = [255, 200, 0]
const HERO_PULSE_MAX_OPACITY = 0.7

export interface HeroPulseTarget {
  node: CommerceNode
  elapsedMs: number
}

export function createHeroPulseLayer(
  target: HeroPulseTarget | null,
): ScatterplotLayer<CommerceNode> | null {
  if (!target) return null
  const { node, elapsedMs } = target
  const phase = (elapsedMs % HERO_PULSE_PERIOD_MS) / HERO_PULSE_PERIOD_MS
  const radius = HERO_PULSE_BASE_RADIUS + phase * (HERO_PULSE_MAX_RADIUS - HERO_PULSE_BASE_RADIUS)
  const alpha = (1 - phase) * HERO_PULSE_MAX_OPACITY * 255
  return new ScatterplotLayer<CommerceNode>({
    id: 'commerce-hero-pulse',
    data: [node],
    pickable: false,
    stroked: false,
    getPosition: (n) => n.coordinates,
    getRadius: radius,
    getFillColor: [...HERO_PULSE_COLOR, alpha] as [number, number, number, number],
    radiusUnits: 'pixels',
    updateTriggers: {
      getRadius: elapsedMs,
      getFillColor: elapsedMs,
    },
  })
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
