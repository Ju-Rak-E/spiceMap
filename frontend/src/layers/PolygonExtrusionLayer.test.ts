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

  it('progress=0 시 모든 elevation이 0 (애니메이션 시작점)', () => {
    const data = buildPolygonExtrusionData(nodes, boundaries, 'griScore', 0)
    for (const d of data) {
      expect(d.elevation).toBe(0)
    }
  })

  it('progress=0.5 시 elevation이 정확히 절반', () => {
    const full = buildPolygonExtrusionData(nodes, boundaries, 'griScore', 1)
    const half = buildPolygonExtrusionData(nodes, boundaries, 'griScore', 0.5)
    const fullHigh = full.find(d => d.id === 'gc_001')!
    const halfHigh = half.find(d => d.id === 'gc_001')!
    expect(halfHigh.elevation).toBeCloseTo(fullHigh.elevation * 0.5, 5)
  })

  it('progress 인자 미지정 시 기본값 1 (기존 동작 보존)', () => {
    const a = buildPolygonExtrusionData(nodes, boundaries, 'griScore')
    const b = buildPolygonExtrusionData(nodes, boundaries, 'griScore', 1)
    expect(a).toEqual(b)
  })
})
