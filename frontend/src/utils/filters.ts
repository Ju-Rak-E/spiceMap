import type { CommerceNode } from '../types/commerce'
import type { CommerceType } from '../styles/tokens'

export function filterNodesByDistrict(nodes: CommerceNode[], districts: Set<string>): CommerceNode[] {
  if (districts.size === 0) return nodes
  return nodes.filter(n => districts.has(n.district))
}

export function filterNodesByType(nodes: CommerceNode[], types: Set<CommerceType>): CommerceNode[] {
  if (types.size === 0) return []
  return nodes.filter(n => types.has(n.type))
}
