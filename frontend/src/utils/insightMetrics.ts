import type { CommerceNode } from '../types/commerce'

export function countCriticalCommerces(nodes: CommerceNode[]): number {
  return nodes.filter((node) => (node.griScore ?? 0) >= 80).length
}
