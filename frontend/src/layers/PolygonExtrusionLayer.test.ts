import { describe, it, expect } from 'vitest'
import { buildPolygonExtrusionData } from './PolygonExtrusionLayer'
import type { CommerceNode } from '../types/commerce'
import type { BoundaryFeature } from '../hooks/use3DView'

const nodes: CommerceNode[] = [
  { id: 'gc_001', name: '강남역', coordinates: [127.02, 37.49], type: '흡수형_과열', district: '강남구', netFlow: 200,
degreeCentrality: 0.8, griScore: 80, closeRate: 10 },
  { id: 'gc_002', name: '역삼동', coordinates: [127.03, 37.50], type: '안정형', district: '강남구', netFlow: 50,
degreeCentrality: 0.3, griScore: 30, closeRate: 2 },
]
const boundaries: BoundaryFeature[] = [
  { comm_id: 'gc_001', polygon: [[127.02,37.49],[127.03,37.49],[127.03,37.50],[127.02,37.50]] },
  { comm_id: 'gc_002', polygon: [[127.03,37.50],[127.04,37.50],[127.04,37.51],[127.03,37.51]] },
  { comm_id: 'gc_999', polygon: [[127.05,37.51],[127.06,37.51],[127.06,37.52],[127.05,37.52]] },
]

describe('buildPolygonExtrusionData', () => {
  it('nodes와 boundaries를 comm_id로 조인한다', () => {
    expect(buildPolygonExtrusionData(nodes, boundaries, 'griScore')).toHaveLength(2)
  })
  it('높은 GRI → 높은 elevation', () => {
    const data = buildPolygonExtrusionData(nodes, boundaries, 'griScore')
    const high = data.find(d => d.id === 'gc_001')!
    const low  = data.find(d => d.id === 'gc_002')!
    expect(high.elevation).toBeGreaterThan(low.elevation)
  })
  it('elevation은 0~3000 범위', () => {
    const data = buildPolygonExtrusionData(nodes, boundaries, 'griScore')
    for (const d of data) {
      expect(d.elevation).toBeGreaterThanOrEqual(0)
      expect(d.elevation).toBeLessThanOrEqual(3000)
    }
  })
  it('매핑 없는 boundary 제외', () => {
    const data = buildPolygonExtrusionData(nodes, boundaries, 'griScore')
    expect(data.map(d => d.id)).not.toContain('gc_999')
  })
})
