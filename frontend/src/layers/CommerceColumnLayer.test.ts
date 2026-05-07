import { describe, it, expect } from 'vitest'
import { createCommerceColumnLayer } from './CommerceColumnLayer'
import type { CommerceNode } from '../types/commerce'

const nodes: CommerceNode[] = [
  { id: 'gc_001', name: '강남역', coordinates: [127.02, 37.49], type: '흡수형_과열', district: '강남구', netFlow: 200,
degreeCentrality: 0.8, griScore: 80 },
  { id: 'gc_002', name: '역삼동', coordinates: [127.03, 37.50], type: '안정형', district: '강남구', netFlow: 50,
degreeCentrality: 0.3, griScore: 30 },
]

describe('createCommerceColumnLayer', () => {
  it('레이어 id가 "commerce-column"', () => {
    const layer = createCommerceColumnLayer(nodes, 'griScore')
    expect(layer.id).toBe('commerce-column')
  })
  it('빈 nodes 배열에서도 에러 없이 생성', () => {
    expect(() => createCommerceColumnLayer([], 'griScore')).not.toThrow()
  })
  it('metric 변경 시 updateTriggers 다름', () => {
    const l1 = createCommerceColumnLayer(nodes, 'griScore')
    const l2 = createCommerceColumnLayer(nodes, 'netFlow')
    expect(l1.props.updateTriggers).not.toEqual(l2.props.updateTriggers)
  })
})
