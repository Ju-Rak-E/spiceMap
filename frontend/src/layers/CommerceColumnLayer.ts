// Stub — Codex가 실제 구현으로 교체 예정
import { ColumnLayer } from '@deck.gl/layers'
import type { CommerceNode } from '../types/commerce'
import type { HeightMetric } from '../hooks/use3DView'

export function createCommerceColumnLayer(
  _nodes: CommerceNode[],
  _metric: HeightMetric,
): ColumnLayer<CommerceNode> {
  return new ColumnLayer({ id: 'commerce-column', data: [] })
}
