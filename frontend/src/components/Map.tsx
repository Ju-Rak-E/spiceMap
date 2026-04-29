import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MapboxOverlay } from '@deck.gl/mapbox'
import type { PickingInfo } from '@deck.gl/core'
import { MAP_THEME, COMMERCE_COLORS, type MapTheme } from '../styles/tokens'
import AdminBoundaryLayer from './AdminBoundaryLayer'
import CommerceDetailPanel from './CommerceDetailPanel'
import { createCommerceNodeLayers } from '../layers/CommerceNodeLayer'
import { createODFlowLayer } from '../layers/ODFlowLayer'
import { createFlowParticleLayer } from '../layers/FlowParticleLayer'
import { useAnimationFrame } from '../hooks/useAnimationFrame'
import type { ODFlow, FlowPurpose } from '../hooks/useFlowData'
import type { CommerceNode } from '../types/commerce'
import { getNodeInterpretation } from '../utils/summaryFormatter'
import { deriveStartupSummary } from '../utils/startupAdvisor'
import { formatSignedFixed2 } from '../utils/numberFormat'
import {
  buildDistrictCommerceClusters,
  buildDongCommerceClusters,
  type AdminBoundaryCollection,
  type DongCommerceCluster,
} from '../utils/mapSummaries'

const VWORLD_LIGHT_STYLE = (apiKey: string): maplibregl.StyleSpecification => ({
  version: 8,
  sources: {
    'vworld-base': {
      type: 'raster',
      tiles: [`https://api.vworld.kr/req/wmts/1.0.0/${apiKey}/Base/{z}/{y}/{x}.png`],
      tileSize: 256,
      attribution: '© VWorld',
    },
  },
  layers: [{ id: 'vworld-base', type: 'raster', source: 'vworld-base' }],
})

const CARTO_DARK_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

const ANIMATION_SPEED = 0.00025
const BASE_VOLUME = 10000
const HOVER_CARD_WIDTH = 220
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
  showFlows?: boolean
  selectedDistricts?: Set<string>
  selectedNode?: CommerceNode | null
  onSelectNode?: (node: CommerceNode | null) => void
}

interface HoveredNode {
  node: CommerceNode
  x: number
  y: number
}

interface ScreenPosition {
  x: number
  y: number
  visible: boolean
}

type ClusterPositionMap = Record<string, ScreenPosition>

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
  showFlows = true,
  selectedDistricts,
  selectedNode = null,
  onSelectNode,
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
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null)
  const detailPanelOpen = selectedNode !== null && closedDetailNodeId !== selectedNode.id

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

    const flowLayers = showFlows
      ? [
          createODFlowLayer(flows, null),
          createFlowParticleLayer(flows, progressRef.current, null),
        ]
      : []

    const commerceLayers = nodes.length > 0 && zoomRef.current >= CANDIDATE_ZOOM
      ? createCommerceNodeLayers(
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
            if (info.object) {
              setClosedDetailNodeId(null)
              setSelectedClusterId(null)
            }
          },
          selectedNode?.id ?? null,
        )
      : []

    overlayRef.current.setProps({
      layers: [...flowLayers, ...commerceLayers],
    })
  }, [flows, nodes, onSelectNode, selectedNode?.id, showFlows])

  useAnimationFrame(handleFrame)

  const focusCommerceNode = useCallback((node: CommerceNode) => {
    const map = mapRef.current
    if (!map) return

    map.easeTo({
      center: node.coordinates,
      zoom: Math.max(map.getZoom(), CANDIDATE_ZOOM + 0.3),
      duration: 650,
      essential: true,
    })
  }, [])

  const colors = MAP_THEME[theme]
  const zoomStage = getZoomStage(zoom)
  const districtClusters = useMemo(() => buildDistrictCommerceClusters(nodes), [nodes])
  const dongClusters = useMemo(() => buildDongCommerceClusters(nodes, boundaries), [nodes, boundaries])
  const clusters = useMemo(() => {
    if (zoomStage === 'district') return districtClusters
    if (zoomStage === 'dong') return dongClusters
    return []
  }, [districtClusters, dongClusters, zoomStage])
  const showClusters = clusters.length > 0
  const selectedCluster = useMemo(
    () => clusters.find((cluster) => cluster.id === selectedClusterId) ?? null,
    [clusters, selectedClusterId],
  )
  const summaryText = nodes.length > 0
    ? `선택 자치구 상권 ${nodes.length.toLocaleString()}개 · 자치구 ${districtClusters.length.toLocaleString()}개 · 행정동 ${dongClusters.length.toLocaleString()}개 · ${hour}시 ${purpose ?? '전체'} 상위 ${topN}개 흐름`
    : ''
  const dataStatusTone = usingMockData ? '#FFCC80' : '#A5D6A7'
  const selectedDistrictCodes = useMemo(
    () => [...(selectedDistricts ?? new Set<string>())]
      .map((district) => DISTRICT_CODES[district])
      .filter((code): code is string => Boolean(code)),
    [selectedDistricts],
  )

  const clusterPositions = useMemo((): ClusterPositionMap => {
    void viewportTick
    if (!mapInstance || containerSize.width === 0 || containerSize.height === 0) return {}
    const next: ClusterPositionMap = {}
    for (const cluster of clusters) {
      const point = mapInstance.project(cluster.center)
      next[cluster.id] = {
        x: point.x,
        y: point.y,
        visible: point.x >= -80
          && point.x <= containerSize.width + 80
          && point.y >= 40
          && point.y <= containerSize.height + 80,
      }
    }
    return next
  }, [clusters, containerSize.height, containerSize.width, mapInstance, viewportTick])

  function getClusterColor(cluster: DongCommerceCluster) {
    if (cluster.tone === 'recommended') return '#43A047'
    if (cluster.tone === 'caution') return '#FB8C00'
    return '#78909C'
  }

  function getClusterDisplayName(cluster: DongCommerceCluster) {
    if (cluster.level === 'district') return `${cluster.dongName} 전체`
    return cluster.dongName
  }

  function getClusterListHint(cluster: DongCommerceCluster) {
    if (cluster.level === 'district') return '확대하면 행정동별 묶음으로 나뉩니다. 항목을 누르면 상권 상세 분석을 엽니다.'
    return '항목을 누르면 해당 상권 상세 분석을 엽니다.'
  }

  function renderClusterBadge(cluster: DongCommerceCluster) {
    if (!showClusters) return null
    const position = clusterPositions[cluster.id]
    if (!position?.visible) return null
    const color = getClusterColor(cluster)
    const active = cluster.id === selectedClusterId

    return (
      <button
        type="button"
        key={cluster.id}
        aria-label={`${getClusterDisplayName(cluster)} 상권 ${cluster.commerceCount}개 추천 ${cluster.recommendedCount} 최고 ${cluster.bestScore}`}
        onClick={() => {
          setSelectedClusterId((prev) => prev === cluster.id ? null : cluster.id)
          onSelectNode?.(null)
        }}
        style={{
          position: 'absolute',
          left: position.x,
          top: position.y,
          transform: 'translate(-50%, -50%)',
          zIndex: 6,
          minWidth: 192,
          background: 'rgba(16,22,29,0.9)',
          border: `1.5px solid ${active ? color : colors.panelBorder}`,
          borderRadius: 10,
          padding: '10px 12px',
          boxShadow: '0 8px 18px rgba(0,0,0,0.3)',
          color: colors.panelText,
          cursor: 'pointer',
          backdropFilter: 'blur(8px)',
          textAlign: 'left',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: color, flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 800, lineHeight: 1.2 }}>
            {getClusterDisplayName(cluster)} 상권 {cluster.commerceCount}개
          </span>
        </div>
        <div style={{ display: 'flex', gap: 9, marginTop: 5, fontSize: 11, color: colors.secondaryText }}>
          <span style={{ color: '#A5D6A7', fontWeight: 700 }}>추천 {cluster.recommendedCount}</span>
          <span>최고 {cluster.bestScore}</span>
          <span>목록 보기</span>
        </div>
      </button>
    )
  }

  function renderClusterPanel() {
    if (!selectedCluster || !showClusters) return null
    const sortedNodes = [...selectedCluster.nodes]
      .sort((a, b) => deriveStartupSummary(b).fitScore - deriveStartupSummary(a).fitScore)

    return (
      <div
        style={{
          position: 'absolute',
          left: 16,
          top: 64,
          zIndex: 18,
          width: 332,
          maxHeight: 'calc(100% - 96px)',
          overflowY: 'auto',
          background: 'rgba(16,22,29,0.96)',
          border: `1px solid ${colors.panelBorder}`,
          borderRadius: 12,
          padding: 12,
          color: colors.panelText,
          boxShadow: '0 12px 28px rgba(0,0,0,0.35)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{getClusterDisplayName(selectedCluster)}</div>
            <div style={{ marginTop: 4, fontSize: 11, color: colors.secondaryText }}>
              상권 {selectedCluster.commerceCount} · 추천 {selectedCluster.recommendedCount} · 최고 {selectedCluster.bestScore}
            </div>
            <div style={{ marginTop: 4, fontSize: 10, color: colors.mutedText }}>
              {getClusterListHint(selectedCluster)}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSelectedClusterId(null)}
            aria-label="행정동 상권 목록 닫기"
            style={{
              background: 'transparent',
              border: 'none',
              color: colors.mutedText,
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
            }}
          >
            x
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 12 }}>
          {sortedNodes.map((node) => {
            const summary = deriveStartupSummary(node)
            const active = selectedNode?.id === node.id
            return (
              <button
                type="button"
                key={node.id}
                onClick={() => {
                  onSelectNode?.(node)
                  setClosedDetailNodeId(null)
                  setSelectedClusterId(null)
                  focusCommerceNode(node)
                }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 8,
                  alignItems: 'center',
                  width: '100%',
                  padding: '9px 10px',
                  borderRadius: 8,
                  border: active ? `1.5px solid ${summary.fitColor}` : `1px solid ${colors.panelBorder}`,
                  borderLeft: active ? `6px solid ${summary.fitColor}` : `1px solid ${colors.panelBorder}`,
                  background: active
                    ? `linear-gradient(90deg, ${summary.fitColor}38, rgba(21,29,38,0.98) 58%)`
                    : 'rgba(21,29,38,0.92)',
                  color: colors.panelText,
                  cursor: 'pointer',
                  textAlign: 'left',
                  boxShadow: active ? `0 0 0 1px ${summary.fitColor}44, 0 8px 18px rgba(0,0,0,0.25)` : 'none',
                }}
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 700 }}>
                  {node.name}
                </span>
                <span style={{ color: summary.fitColor, fontSize: 12, fontWeight: 800 }}>
                  {summary.fitScore}
                </span>
                <span style={{ color: colors.secondaryText, fontSize: 10 }}>
                  {summary.fitLabel}
                </span>
                <span style={{ color: COMMERCE_COLORS[node.type].textColor, fontSize: 10, textAlign: 'right' }}>
                  {COMMERCE_COLORS[node.type].label}
                </span>
              </button>
            )
          })}
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

      {clusters.map(renderClusterBadge)}
      {renderClusterPanel()}

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
              border: `1px solid ${startup.fitColor}`,
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
          node={selectedNode}
          quarter={selectedQuarter}
          usingMockData={usingMockData}
          onClose={() => setClosedDetailNodeId(selectedNode?.id ?? null)}
        />
      )}

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
          데모 데이터 표시 중
        </div>
      )}
    </div>
  )
}
