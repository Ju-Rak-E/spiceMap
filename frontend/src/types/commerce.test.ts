import { describe, it, expect } from 'vitest'
import { featuresToNodes, type CommerceFeature } from './commerce'

function makeFeature(overrides: Partial<CommerceFeature> = {}): CommerceFeature {
  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [[126.9, 37.5], [126.95, 37.5], [126.95, 37.55], [126.9, 37.55], [126.9, 37.5]],
      ],
    },
    properties: {
      comm_cd: 'GN001',
      comm_nm: '테스트상권',
      comm_type: '안정형',
      gri_score: 55.0,
      flow_volume: 1200,
      dominant_origin: null,
      analysis_note: null,
      centroid_lng: null,
      centroid_lat: null,
    },
    ...overrides,
  }
}

describe('featuresToNodes', () => {
  describe('centroid 좌표 결정', () => {
    it('centroid_lng/lat가 있으면 그 값을 사용한다', () => {
      const feature = makeFeature({
        properties: { ...makeFeature().properties, centroid_lng: 127.1, centroid_lat: 37.6 },
      })
      const [node] = featuresToNodes([feature])
      expect(node.coordinates).toEqual([127.1, 37.6])
    })

    it('centroid가 없으면 Polygon bbox 중심으로 폴백한다', () => {
      const feature = makeFeature()
      const [node] = featuresToNodes([feature])
      // bbox: lng 126.9~126.95, lat 37.5~37.55 → 중심 [126.925, 37.525]
      expect(node.coordinates[0]).toBeCloseTo(126.925, 3)
      expect(node.coordinates[1]).toBeCloseTo(37.525, 3)
    })

    it('MultiPolygon에서도 bbox 중심으로 폴백한다', () => {
      const feature = makeFeature({
        geometry: {
          type: 'MultiPolygon',
          coordinates: [
            [[[127.0, 37.4], [127.1, 37.4], [127.1, 37.5], [127.0, 37.5], [127.0, 37.4]]],
          ],
        },
      })
      const [node] = featuresToNodes([feature])
      expect(node.coordinates[0]).toBeCloseTo(127.05, 3)
      expect(node.coordinates[1]).toBeCloseTo(37.45, 3)
    })

    it('geometry 타입이 Point면 해당 노드를 건너뛴다', () => {
      const feature = makeFeature({
        geometry: { type: 'Point', coordinates: [127.0, 37.5] },
      })
      const nodes = featuresToNodes([feature])
      expect(nodes).toHaveLength(0)
    })
  })

  describe('필드 매핑', () => {
    it('comm_cd → id, comm_nm → display name으로 매핑한다', () => {
      const [node] = featuresToNodes([makeFeature()])
      expect(node.id).toBe('GN001')
      expect(node.name).toBe('테스트상권')
    })

    it('net_flow를 netFlow로 매핑한다', () => {
      const feature = makeFeature({
        properties: { ...makeFeature().properties, net_flow: -3500 },
      })
      const [node] = featuresToNodes([feature])
      expect(node.netFlow).toBe(-3500)
    })

    it('랜드마크형 상권명은 일대 표현을 붙인다', () => {
      const feature = makeFeature({
        properties: { ...makeFeature().properties, comm_nm: '당곡중학교' },
      })
      const [node] = featuresToNodes([feature])
      expect(node.name).toBe('당곡중학교 일대')
    })

    it('상권 성격이 명확한 이름은 일대 표현을 중복하지 않는다', () => {
      const feature = makeFeature({
        properties: { ...makeFeature().properties, comm_nm: '강남 마이스 관광특구' },
      })
      const [node] = featuresToNodes([feature])
      expect(node.name).toBe('강남 마이스 관광특구')
    })

    it('gri_score를 griScore로 매핑한다', () => {
      const feature = makeFeature({
        properties: { ...makeFeature().properties, gri_score: 72.4 },
      })
      const [node] = featuresToNodes([feature])
      expect(node.griScore).toBe(72.4)
    })

    it('net_flow가 null이면 netFlow를 0으로 폴백한다', () => {
      const feature = makeFeature({
        properties: { ...makeFeature().properties, net_flow: null },
      })
      const [node] = featuresToNodes([feature])
      expect(node.netFlow).toBe(0)
    })

    it('gri_score가 null이면 griScore를 0으로 폴백한다', () => {
      const feature = makeFeature({
        properties: { ...makeFeature().properties, gri_score: null },
      })
      const [node] = featuresToNodes([feature])
      expect(node.griScore).toBe(0)
    })

    it('degreeCentrality는 항상 0 (Dev-C Module A 완성 전 폴백)', () => {
      const [node] = featuresToNodes([makeFeature()])
      expect(node.degreeCentrality).toBe(0)
    })
  })

  describe('comm_type 검증', () => {
    it('유효한 comm_type은 그대로 사용한다', () => {
      const types = ['흡수형_과열', '흡수형_성장', '방출형_침체', '고립형_단절', '안정형', '미분류'] as const
      for (const t of types) {
        const feature = makeFeature({
          properties: { ...makeFeature().properties, comm_type: t },
        })
        const [node] = featuresToNodes([feature])
        expect(node.type).toBe(t)
      }
    })

    it('알 수 없는 comm_type은 "미분류"로 폴백한다', () => {
      const feature = makeFeature({
        properties: { ...makeFeature().properties, comm_type: 'UNKNOWN_TYPE' },
      })
      const [node] = featuresToNodes([feature])
      expect(node.type).toBe('미분류')
    })

    it('comm_type이 null이면 "미분류"로 폴백한다', () => {
      const feature = makeFeature({
        properties: { ...makeFeature().properties, comm_type: null },
      })
      const [node] = featuresToNodes([feature])
      expect(node.type).toBe('미분류')
    })

    it('unclassified comm_type은 "미분류"로 매핑한다', () => {
      const feature = makeFeature({
        properties: { ...makeFeature().properties, comm_type: 'unclassified' },
      })
      const [node] = featuresToNodes([feature])
      expect(node.type).toBe('미분류')
    })

    it('commerce_type이 있으면 comm_type보다 우선한다', () => {
      const feature = makeFeature({
        geometry: { type: 'Point', coordinates: [127, 37] },
        properties: {
          ...makeFeature().properties,
          comm_cd: 'gc_001',
          comm_nm: '테스트',
          commerce_type: '흡수형_과열',
          comm_type: '골목상권',
          gri_score: null,
          flow_volume: null,
          dominant_origin: null,
          analysis_note: null,
          centroid_lng: 127,
          centroid_lat: 37,
        },
      })
      const [node] = featuresToNodes([feature])
      expect(node.type).toBe('흡수형_과열')
    })
  })

  describe('배열 처리', () => {
    it('빈 배열을 받으면 빈 배열을 반환한다', () => {
      expect(featuresToNodes([])).toHaveLength(0)
    })

    it('여러 features를 모두 변환한다', () => {
      const features = [
        makeFeature({ properties: { ...makeFeature().properties, comm_cd: 'A' } }),
        makeFeature({ properties: { ...makeFeature().properties, comm_cd: 'B' } }),
        makeFeature({ properties: { ...makeFeature().properties, comm_cd: 'C' } }),
      ]
      const nodes = featuresToNodes(features)
      expect(nodes).toHaveLength(3)
      expect(nodes.map(n => n.id)).toEqual(['A', 'B', 'C'])
    })

    it('좌표 추출 불가 노드는 결과에서 제외된다', () => {
      const features = [
        makeFeature({ properties: { ...makeFeature().properties, comm_cd: 'OK' } }),
        makeFeature({
          properties: { ...makeFeature().properties, comm_cd: 'SKIP' },
          geometry: { type: 'Point', coordinates: [127.0, 37.5] },
        }),
      ]
      const nodes = featuresToNodes(features)
      expect(nodes).toHaveLength(1)
      expect(nodes[0].id).toBe('OK')
    })
  })
})
