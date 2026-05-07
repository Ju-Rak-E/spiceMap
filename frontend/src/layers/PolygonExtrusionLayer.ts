// Stub — Codex가 실제 구현으로 교체 예정
import { PolygonLayer } from '@deck.gl/layers'
import type { CommerceNode } from '../types/commerce'
import type { BoundaryFeature, HeightMetric } from '../hooks/use3DView'

export function buildPolygonExtrusionData(_nodes: CommerceNode[], _boundaries: BoundaryFeature[], _metric: HeightMetric): {id:string;polygon:number[][];elevation:number;color:[number,number,number,number]}[] {
  return []
}

export function createPolygonExtrusionLayer(
  _nodes: CommerceNode[],
  _boundaries: BoundaryFeature[],
  _metric: HeightMetric,
): PolygonLayer<{id:string;polygon:number[][];elevation:number;color:[number,number,number,number]}> {
  return new PolygonLayer({ id: 'commerce-polygon-extrusion', data: [] })
}
