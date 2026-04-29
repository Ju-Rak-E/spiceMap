import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MapboxOverlay } from '@deck.gl/mapbox'
import type { PickingInfo } from '@deck.gl/core'
import { MAP_THEME, COMMERCE_COLORS, type MapTheme, type CommerceType } from '../styles/tokens'
import AdminBoundaryLayer from './AdminBoundaryLayer'
import CommerceDetailPanel from './CommerceDetailPanel'
import CommerceLegend from './CommerceLegend'
import { createCommerceNodeLayers } from '../layers/CommerceNodeLayer'
import { createODFlowLayer } from '../layers/ODFlowLayer'
import { createFlowParticleLayer } from '../layers/FlowParticleLayer'
import { useAnimationFrame } from '../hooks/useAnimationFrame'
import type { ODFlow, FlowPurpose } from '../hooks/useFlowData'
import type { CommerceNode } from '../types/commerce'
import { buildSummaryText, getNodeInterpretation } from '../utils/summaryFormatter'
import { deriveStartupSummary } from '../utils/startupAdvisor'
import { formatSignedFixed2 } from '../utils/numberFormat'
import {
  buildDistrictSummaries,
  buildDongSummaries,
  type AdminBoundaryCollection,
  type MapSummaryBadge,
} from '../utils/mapSummaries'

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

const ANIMATION_SPEED = 0.00025
const BASE_VOLUME = 10000
const HOVER_CARD_WIDTH = 220 // estimated from minWidth:180 + padding + badge
const DISTRICT_ZOOM = 10.5
const DONG_ZOOM = 12.5
const CANDIDATE_ZOOM = 14.5
const DISTRICT_CODES: Record<string, string> = {
  '강남구': '1123',
  '관악구': '1121',
}

type ZoomStage = 'city' | 'district' | 'dong' | 'candidate'

function getZoomStage(zoom: number): ZoomStage {
  if (zoom < DISTRICT_ZOOM) return 'city'
  if (zoom < DONG_ZOOM) return 'district'
  if (zoom < CANDIDATE_ZOOM) return 'dong'
  return 'candidate'
}

interface MapProps {
  theme?: MapTheme
  flows: ODFlow[]
  nodes: CommerceNode[]
  usingMockData: boolean
  hour: number
  purpose: FlowPurpose | null
  topN: number
  scopeLabel: string
  dataStatusLabel: string
  selectedQuarter: string
  boundaryOpacity?: number
  selectedTypes?: Set<CommerceType>
  selectedDistricts?: Set<string>
  selectedNode?: CommerceNode | null
  onSelectNode?: (node: CommerceNode | null) => void
  onToggleType?: (type: CommerceType) => void
}

interface HoveredNode {
  node: CommerceNode
  x: number
  y: number
}

interface SummaryBadgePosition {
  x: number
  y: number
  visible: boolean
}

export default function Map({
  theme = 'dark',
  flows,
  nodes,
  usingMockData,
  hour,
  purpose,
  topN,
  scopeLabel,
  dataStatusLabel,
  selectedQuarter,
  boundaryOpacity = 0.2,
  selectedTypes,
  selectedDistricts,
  selectedNode,
  onSelectNode,
  onToggleType,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const overlayRef = useRef<MapboxOverlay | null>(null)
  const progressRef = useRef(0)
  const zoomRef = useRef(11)
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null)
  const [hoveredNode, setHoveredNode] = useState<HoveredNode | null>(null)
  const [closedDetailNodeId, setClosedDetailNodeId] = useState<string | null>(null)
  const [zoom, setZoom] = useState(11)
  const [viewportTick, setViewportTick] = useState(0)
  const [boundaries, setBoundaries] = useState<AdminBoundaryCollection | null>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const detailPanelOpen = !selectedNode || closedDetailNodeId !== selectedNode.id

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

    let viewFrame: number | null = null
    const syncView = () => {
      if (viewFrame !== null) return
      viewFrame = window.requestAnimationFrame(() => {
        viewFrame = null
        const z = map.getZoom()
        zoomRef.current = z
        setZoom(z)
        setViewportTick(prev => prev + 1)
        if (z < CANDIDATE_ZOOM) setHoveredNode(null)
      })
    }

    map.on('zoom', syncView)
    map.on('move', syncView)

    map.once('load', () => {
      mapRef.current = map
      syncView()
      setMapInstance(map)
    })

    return () => {
      if (viewFrame !== null) window.cancelAnimationFrame(viewFrame)
      map.off('zoom', syncView)
      map.off('move', syncView)
      overlayRef.current = null
      map.remove()
      mapRef.current = null
      setMapInstance(null)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useLayoutEffect(() => {
    const map = mapRef.current
    if (!map) return
    const apiKey = import.meta.env.VITE_VWORLD_API_KEY as string
    map.setStyle(theme === 'dark' ? CARTO_DARK_STYLE : VWORLD_LIGHT_STYLE(apiKey))
  }, [theme])

  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateSize = () => {
      setContainerSize({
        width: container.clientWidth,
        height: container.clientHeight,
      })
    }

    updateSize()
    const observer = new ResizeObserver(updateSize)
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false

    fetch('/data/seoul_admin_boundary.geojson')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json() as Promise<AdminBoundaryCollection>
      })
      .then((data) => {
        if (!cancelled) setBoundaries(data)
      })
      .catch(() => {
        if (!cancelled) setBoundaries(null)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const handleFrame = useCallback((delta: number) => {
    const totalVolume = flows.reduce((sum, f) => sum + f.volume, 0)
    const speedScale = Math.max(0.3, Math.min(2.0, Math.sqrt(totalVolume / BASE_VOLUME)))
    progressRef.current = (progressRef.current + delta * ANIMATION_SPEED * speedScale) % 1

    if (!overlayRef.current) return

    const stage = getZoomStage(zoomRef.current)

    const flowLayers = [
      createODFlowLayer(flows, selectedNode?.id ?? null),
      createFlowParticleLayer(flows, progressRef.current, selectedNode?.id ?? null),
    ]

    overlayRef.current.setProps({
      layers: stage === 'candidate'
        ? [
            ...flowLayers,
            ...createCommerceNodeLayers(
              nodes,
              (info: PickingInfo<CommerceNode>) => {
                if (info.object) {
                  setHoveredNode({ node: info.object, x: info.x, y: info.y })
                } else {
                  setHoveredNode(null)
                }
              },
              (info: PickingInfo<CommerceNode>) => {
                onSelectNode?.(info.object ?? null)
                if (info.object) setClosedDetailNodeId(null)
              },
              selectedNode?.id ?? null,
            ),
          ]
        : flowLayers,
    })
  }, [flows, nodes, onSelectNode, selectedNode?.id])

  useAnimationFrame(handleFrame)

  const colors = MAP_THEME[theme]
  const summaryText = selectedTypes
    ? buildSummaryText(purpose, hour, topN, selectedTypes, nodes)
    : null
  const dataStatusTone = usingMockData ? '#FFCC80' : '#A5D6A7'
  const legendBottom = selectedNode ? 298 : 40
  const zoomStage = getZoomStage(zoom)
  const districtSummaries = useMemo(() => buildDistrictSummaries(nodes), [nodes])
  const dongSummaries = useMemo(() => buildDongSummaries(nodes, boundaries), [nodes, boundaries])
  const visibleSummaries = useMemo(() => {
    if (zoomStage === 'district') return districtSummaries
    if (zoomStage === 'dong') return dongSummaries
    return []
  }, [districtSummaries, dongSummaries, zoomStage])
  const selectedDistrictCodes = useMemo(
    () => [...(selectedDistricts ?? new Set<string>())]
      .map((district) => DISTRICT_CODES[district])
      .filter((code): code is string => Boolean(code)),
    [selectedDistricts],
  )

  const summaryPositions = useMemo(() => {
    void viewportTick
    if (!mapInstance || containerSize.width === 0 || containerSize.height === 0) return {}
    const next: Record<string, SummaryBadgePosition> = {}
    for (const summary of visibleSummaries) {
      const point = mapInstance.project(summary.coord)
      next[summary.id] = {
        x: point.x,
        y: point.y,
        visible: point.x >= -80
          && point.x <= containerSize.width + 80
          && point.y >= 40
          && point.y <= containerSize.height + 80,
      }
    }
    return next
  }, [containerSize.height, containerSize.width, mapInstance, viewportTick, visibleSummaries])

  function renderSummaryBadge(summary: MapSummaryBadge) {
    const position = summaryPositions[summary.id]
    if (!position?.visible) return null

    return (
      <div
        key={summary.id}
        style={{
          position: 'absolute',
          left: position.x,
          top: position.y,
          transform: 'translate(-50%, -50%)',
          zIndex: 6,
          minWidth: 136,
          background: 'rgba(16,22,29,0.9)',
          border: `1px solid ${colors.panelBorder}`,
          borderRadius: 6,
          padding: '8px 10px',
          boxShadow: '0 8px 18px rgba(0,0,0,0.3)',
          color: colors.panelText,
          pointerEvents: 'none',
          backdropFilter: 'blur(8px)',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, lineHeight: 1.2 }}>{summary.label}</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 5, fontSize: 11, color: colors.secondaryText }}>
          <span>후보 {summary.candidateCount}</span>
          <span style={{ color: '#A5D6A7', fontWeight: 700 }}>최고 {summary.bestScore}</span>
        </div>
        <div style={{ marginTop: 3, fontSize: 10, color: colors.mutedText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {summary.dominantTypeLabel}
        </div>
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div
        ref={containerRef}
        style={{ width: '100%', height: '100%', background: colors.background }}
      />

      {mapInstance && (
        <AdminBoundaryLayer
          map={mapInstance}
          theme={theme}
          districtFilter={null}
          districtFilters={selectedDistrictCodes}
          fillOpacity={boundaryOpacity}
        />
      )}

      {visibleSummaries.map(renderSummaryBadge)}

      {/* 상단 종합 해설바 */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          background: 'rgba(16,22,29,0.92)',
          borderBottom: `1px solid ${colors.panelBorder}`,
          padding: '10px 16px',
          zIndex: 6,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          pointerEvents: 'none',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: colors.panelText, whiteSpace: 'nowrap' }}>
          서울 창업 상권 지도
        </div>
        <div style={{ width: 1, height: 18, background: colors.panelBorder, flexShrink: 0 }} />
        {summaryText && (
          <div style={{ fontSize: 12, color: colors.secondaryText, lineHeight: 1.5, flex: 1 }}>
            {summaryText}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <span
            style={{
              background: 'rgba(21,29,38,0.95)',
              border: `1px solid ${colors.panelBorder}`,
              borderRadius: 999,
              padding: '3px 8px',
              fontSize: 10,
              color: colors.secondaryText,
            }}
          >
            {scopeLabel}
          </span>
          <span
            style={{
              background: 'rgba(21,29,38,0.95)',
              border: `1px solid ${colors.panelBorder}`,
              borderRadius: 999,
              padding: '3px 8px',
              fontSize: 10,
              color: dataStatusTone,
            }}
          >
            {dataStatusLabel}
          </span>
        </div>
      </div>

      {/* 노드 미니 해설 카드 */}
      {hoveredNode && (() => {
        const { node, x, y } = hoveredNode
        const containerWidth = containerSize.width || window.innerWidth
        const rawLeft = x + 14 + HOVER_CARD_WIDTH > containerWidth
          ? x - 14 - HOVER_CARD_WIDTH
          : x + 14
        const cardLeft = Math.max(0, rawLeft)
        const token = COMMERCE_COLORS[node.type]
        const startup = deriveStartupSummary(node)
        const netFlowColor = node.netFlow >= 0 ? '#A5D6A7' : '#EF9A9A'
        const interpretation = getNodeInterpretation(node.type, node.griScore)
        return (
          <div
            style={{
              position: 'absolute',
              left: cardLeft,
              top: y - 12,
              background: colors.panelBg,
              color: colors.panelText,
              border: `1px solid ${token.outline}`,
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 13,
              pointerEvents: 'none',
              zIndex: 10,
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              whiteSpace: 'nowrap',
              minWidth: 180,
            }}
          >
            {/* 상권명 + 유형 배지 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{node.name}</span>
              <span
                style={{
                  background: `${startup.fitColor}22`,
                  color: startup.fitColor,
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: 4,
                  padding: '2px 6px',
                  letterSpacing: '0.03em',
                }}
              >
                {startup.fitLabel}
              </span>
            </div>

            {/* 유형 배지 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: token.fill,
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
                aria-label={token.label}
              >
                {token.symbol}
              </span>
              <span style={{ fontSize: 12, color: token.textColor }}>{startup.characterLabel}</span>
            </div>

            {/* 지표 2열 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 10, color: colors.mutedText, marginBottom: 1 }}>적합도</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: startup.fitColor }}>{startup.fitScore}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: colors.mutedText, marginBottom: 1 }}>순유입</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: netFlowColor }}>
                  {formatSignedFixed2(node.netFlow)}
                </div>
              </div>
            </div>

            {/* 1줄 상태 해석 */}
            <div
              style={{
                fontSize: 11,
                color: colors.secondaryText,
                borderTop: `1px solid ${colors.panelBorder}`,
                paddingTop: 6,
                lineHeight: 1.4,
              }}
            >
              {startup.headline} {interpretation}
            </div>
          </div>
        )
      })()}

      {/* 상권 유형 범례 (필터 겸용) */}
      {selectedTypes && onToggleType && (
        <CommerceLegend
          theme={theme}
          bottom={legendBottom}
          selectedTypes={selectedTypes}
          onToggle={onToggleType}
        />
      )}

      {selectedNode && !detailPanelOpen && (
        <button
          type="button"
          onClick={() => setClosedDetailNodeId(null)}
          style={{
            position: 'absolute',
            left: 16,
            top: 64,
            zIndex: 12,
            border: `1px solid ${colors.panelBorder}`,
            borderRadius: 999,
            background: 'rgba(16,22,29,0.94)',
            color: colors.panelText,
            padding: '9px 12px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 8px 20px rgba(0,0,0,0.28)',
          }}
        >
          상권 분석 열기
        </button>
      )}

      {detailPanelOpen && (
        <CommerceDetailPanel
          node={selectedNode ?? null}
          quarter={selectedQuarter}
          usingMockData={usingMockData}
          onClose={() => setClosedDetailNodeId(selectedNode?.id ?? null)}
        />
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
