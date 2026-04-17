import type { CommerceType } from '../styles/tokens'

export interface CommerceNode {
  id: string
  name: string
  coordinates: [number, number]  // [lng, lat]
  type: CommerceType
  netFlow: number                // 순유입 (양수=유입, 음수=유출)
  degreeCentrality: number       // 0~1
  griScore: number               // 0~100
}

export interface CommerceTypeMapResponse {
  nodes: CommerceNode[]
  updatedAt: string
}
