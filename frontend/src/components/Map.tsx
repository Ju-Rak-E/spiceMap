import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MapboxOverlay } from '@deck.gl/mapbox'
import type { PickingInfo } from '@deck.gl/core'
import { MAP_THEME, type MapTheme } from '../styles/tokens'
import AdminBoundaryLayer from './AdminBoundaryLayer'
import { createCommerceNodeLayer } from '../layers/CommerceNodeLayer'
import { createODFlowLayer } from '../layers/ODFlowLayer'
import { createFlowParticleLayer } from '../layers/FlowParticleLayer'
import { useAnimationFrame } from '../hooks/useAnimationFrame'
import type { ODFlow, FlowPurpose } from '../hooks/useFlowData'
import type { CommerceNode } from '../types/commerce'

const VWORLD_LIGHT_STYLE = (apiKey: string): maplibregl.StyleSpecification => ({
  version: 8,
  sources: {
    'vworld-base': {
      type: 'raster',
      tiles: [`https://api.vworld.kr/req/wmts/1.0.0/${apiKey}/Base/{z}/{y}/{x}.png`],
      tileSize: 256,
      attribution: '© 국토지리정보원',
    },
  },
  layers: [{ id: 'vworld-base', type: 'raster', source: 'vworld-base' }],
})

const CARTO_DARK_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

const ANIMATION_SPEED = 0.00025  // progress per ms (1사이클 ≈ 4초)

interface MapProps {
  theme?: MapTheme
  flows: ODFlow[]
  nodes: CommerceNode[]
  usingMockData: boolean
  hour: number
  purpose: FlowPurpose | null
  boundaryOpacity?: number
  onNodeClick?: (node: CommerceNode) => void
}

interface HoveredNode {
  node: CommerceNode
  x: number
  y: number
}

export default function Map({
  theme = 'dark',
  flows,
  nodes,
  usingMockData,
  hour,
  purpose,
  boundaryOpacity = 0.3,
  onNodeClick,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const overlayRef = useRef<MapboxOverlay | null>(null)
  const progressRef = useRef(0)
  const [mapReady, setMapReady] = useState(false)
  const [hoveredNode, setHoveredNode] = useState<HoveredNode | null>(null)

  // 지도 초기화 (마운트 시 1회)
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const apiKey = import.meta.env.VITE_VWORLD_API_KEY as string
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: theme === 'dark' ? CARTO_DARK_STYLE : VWORLD_LIGHT_STYLE(apiKey),
      center: [126.978, 37.566],
      zoom: 11,
      minZoom: 9,
      maxZoom: 18,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')

    const overlay = new MapboxOverlay({ interleaved: false, layers: [] })
    map.addControl(overlay)
    overlayRef.current = overlay

    map.once('load', () => {
      mapRef.current = map
      setMapReady(true)
    })

    return () => {
      overlayRef.current = null
      map.remove()
      mapRef.current = null
      setMapReady(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 테마 전환
  useLayoutEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apiKey = import.meta.env.VITE_VWORLD_API_KEY as string
    map.setStyle(theme === 'dark' ? CARTO_DARK_STYLE : VWORLD_LIGHT_STYLE(apiKey))
  }, [theme])

  // RAF 애니메이션 루프 — progress를 매 프레임 증가시켜 파티클 이동
  const handleFrame = useCallback((delta: number) => {
    progressRef.current = (progressRef.current + delta * ANIMATION_SPEED) % 1

    if (!overlayRef.current) return
    overlayRef.current.setProps({
      layers: [
        createODFlowLayer(flows),
        createFlowParticleLayer(flows, progressRef.current),
        createCommerceNodeLayer(nodes, (info: PickingInfo<CommerceNode>) => {
          if (info.object) {
            setHoveredNode({ node: info.object, x: info.x, y: info.y })
          } else {
            setHoveredNode(null)
          }
        }, (info: PickingInfo<CommerceNode>) => {
          if (info.object) {
            onNodeClick?.(info.object)
          }
        }),
      ],
    })
  }, [flows, nodes, onNodeClick])

  useAnimationFrame(handleFrame)

  const colors = MAP_THEME[theme]

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', background: colors.background }}
      />

      {mapReady && mapRef.current && (
        <AdminBoundaryLayer
          map={mapRef.current}
          theme={theme}
          districtFilter={null}
          fillOpacity={boundaryOpacity}
        />
      )}

      {/* 지도 타이틀 */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          pointerEvents: 'none',
          zIndex: 5,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 700, color: '#ECEFF1', lineHeight: 1.2 }}>
          서울 스파이스 흐름 지도
        </div>
        <div style={{ fontSize: 11, color: '#546E7A', marginTop: 3 }}>
          수도권 생활이동 × 상권 데이터 × AI 분석
        </div>
      </div>

      {/* 하단 상태 표시줄 */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          fontSize: 12,
          color: '#90A4AE',
          pointerEvents: 'none',
          zIndex: 5,
        }}
      >
        평일 {hour}시 · {purpose ?? '전체'} 흐름
      </div>

      {/* 노드 툴팁 */}
      {hoveredNode && (
        <div
          style={{
            position: 'absolute',
            left: hoveredNode.x + 12,
            top: hoveredNode.y - 8,
            background: '#1A2332',
            color: '#ECEFF1',
            border: '1px solid #455A64',
            borderRadius: 6,
            padding: '6px 10px',
            fontSize: 13,
            pointerEvents: 'none',
            zIndex: 10,
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            whiteSpace: 'nowrap',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 2 }}>{hoveredNode.node.name}</div>
          <div>GRI {hoveredNode.node.griScore}</div>
          <div style={{ color: hoveredNode.node.netFlow >= 0 ? '#43A047' : '#EF5350', fontSize: 12 }}>
            순유입 {hoveredNode.node.netFlow >= 0 ? '+' : ''}{hoveredNode.node.netFlow}
          </div>
        </div>
      )}

      {/* 목 데이터 배너 */}
      {usingMockData && (
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(0,0,0,0.6)',
            color: '#FFF',
            borderRadius: 4,
            padding: '4px 12px',
            fontSize: 12,
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          캐시 데이터로 표시 중
        </div>
      )}
    </div>
  )
}
