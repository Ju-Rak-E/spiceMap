import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { MapboxOverlay } from '@deck.gl/mapbox'
import type { PickingInfo } from '@deck.gl/core'
import { LightingEffect, AmbientLight, DirectionalLight } from '@deck.gl/core'
import { MAP_THEME, COMMERCE_COLORS, type CommerceType, type MapTheme } from '../styles/tokens'
import { use3DView } from '../hooks/use3DView'
import ThreeDViewControl from './ThreeDViewControl'
import { createPolygonExtrusionLayer, createPolygonOutlineLayer } from '../layers/PolygonExtrusionLayer'
import { createCommerceColumnLayer } from '../layers/CommerceColumnLayer'
import AdminBoundaryLayer from './AdminBoundaryLayer'
import CommerceBoundaryLayer from './CommerceBoundaryLayer'
import CommerceDetailPanel from './CommerceDetailPanel'
import { createCommerceNodeLayers, createHeroPulseLayer, getAdvisorColorHex, type AdvisorTierMap } from '../layers/CommerceNodeLayer'
import { createODFlowLayer } from '../layers/ODFlowLayer'
import { createFlowParticleLayer } from '../layers/FlowParticleLayer'
import { createFlowBarrierLayers } from '../layers/FlowBarrierLayer'
import { createDisruptedBarrierParticleLayer } from '../layers/DisruptedBarrierParticleLayer'
import { useAnimationFrame } from '../hooks/useAnimationFrame'
import { getMetricLabel, formatMetricValue } from '../utils/threeDUtils'
import type { HeightMetric } from '../hooks/use3DView'
import { useBarriers, type Barrier } from '../hooks/useBarriers'
import { useBarrierRoutes } from '../hooks/useBarrierRoutes'
import type { ODFlow, FlowPurpose } from '../hooks/useFlowData'
import type { CommerceNode } from '../types/commerce'
import { buildSummaryText, getNodeInterpretation } from '../utils/summaryFormatter'
import { deriveStartupSummary } from '../utils/startupAdvisor'
import { formatSignedFixed2 } from '../utils/numberFormat'
import { markMapLoadEnd, markMapLoadStart } from '../utils/mapPerformance'
import { getFlowProgressIncrement } from '../utils/flowAnimation'
import { PURPOSE_COLORS } from '../utils/flowBezier'
import { selectBalancedBarriers } from '../utils/barrierSelection'
import { SEOUL_DISTRICT_CODE_BY_NAME, SEOUL_DISTRICT_NAMES } from '../utils/seoulDistricts'
import { resolveCommerceDisplayPolicy } from '../utils/commerceDisplayPolicy'
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

const HOVER_CARD_WIDTH = 220
const FLOW_HOVER_CARD_WIDTH = 260
const BARRIER_PANEL_WIDTH = 318
const LEFT_PANEL_GAP = 12
const DETAIL_PANEL_DEFAULT_WIDTH = 360
const DETAIL_PANEL_MIN_WIDTH = 300
const DETAIL_PANEL_MAX_WIDTH = 560
const CLUSTER_PANEL_WIDTH = 332
const DISTRICT_ZOOM = 10.5
const DONG_ZOOM = 12.5
const CANDIDATE_ZOOM = 14.5
const ALL_COMMERCE_TYPES = new Set(Object.keys(COMMERCE_COLORS) as CommerceType[])
const OVERVIEW_BARRIER_LIMIT = 8

type ZoomStage = 'city' | 'district' | 'dong' | 'candidate'
type BarrierSeverity = Barrier['severity']

function getZoomStage(zoom: number): ZoomStage {
  if (zoom < DISTRICT_ZOOM) return 'city'
  if (zoom < DONG_ZOOM) return 'district'
  if (zoom < CANDIDATE_ZOOM) return 'dong'
  return 'candidate'
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function formatFlowVolume(value: number): string {
  if (value >= 10000) return `${(value / 10000).toFixed(1)}만 명`
  return `${value.toLocaleString()}명`
}

function getFlowEndpointName(name: string | undefined, id: string): string {
  return name && name.trim().length > 0 ? name : id
}

function getNodesInViewport(
  nodes: CommerceNode[],
  map: maplibregl.Map | null,
  selectedNode: CommerceNode | null,
): CommerceNode[] {
  if (!map) return nodes

  const bounds = map.getBounds()
  const west = bounds.getWest()
  const east = bounds.getEast()
  const south = bounds.getSouth()
  const north = bounds.getNorth()

  const visibleNodes = nodes.filter((node) => {
    const [lng, lat] = node.coordinates
    return lng >= west && lng <= east && lat >= south && lat <= north
  })

  if (selectedNode && !visibleNodes.some((node) => node.id === selectedNode.id)) {
    return [selectedNode, ...visibleNodes]
  }

  return visibleNodes
}

interface MapProps {
  theme?: MapTheme
  flows: ODFlow[]
  nodes: CommerceNode[]
  usingMockData: boolean
  hour: number
  purpose: FlowPurpose | null
  topN: number
  flowStrength: number
  scopeLabel: string
  dataStatusLabel: string
  selectedQuarter: string
  boundaryOpacity?: number
  showFlows?: boolean
  showBarriers?: boolean
  selectedDistricts?: Set<string>
  selectedNode?: CommerceNode | null
  onSelectNode?: (node: CommerceNode | null) => void
  // docs/preview/hero_shot_scenario.md §1-2: ?hero=1 진입 시 신림(gw_001)을 펄싱으로 강조.
  heroNodeId?: string | null
  advisorTiers?: AdvisorTierMap | null
}

interface HoveredNode {
  node: CommerceNode
  x: number
  y: number
}

interface HoveredBarrier {
  barrier: Barrier
  x: number
  y: number
}

interface HoveredFlow {
  flow: ODFlow
  x: number
  y: number
}

interface Hovered3D {
  title: string
  subtitle: string | null
  metric: HeightMetric
  value: number
  x: number
  y: number
}

const BARRIER_SEVERITY_META: Record<BarrierSeverity, { label: string; color: string; bg: string }> = {
  high: { label: '심각', color: '#EF5350', bg: 'rgba(239,83,80,0.16)' },
  medium: { label: '주의', color: '#F06292', bg: 'rgba(240,98,146,0.16)' },
  low: { label: '관찰', color: '#C084FC', bg: 'rgba(192,132,252,0.14)' },
}

function formatBarrierVolume(value: number): string {
  if (value >= 10000) return `${(value / 10000).toFixed(1)}만`
  return value.toLocaleString()
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
  flowStrength,
  scopeLabel,
  dataStatusLabel,
  selectedQuarter,
  boundaryOpacity = 0.2,
  showFlows = true,
  showBarriers = false,
  selectedDistricts,
  selectedNode = null,
  onSelectNode,
  heroNodeId = null,
  advisorTiers = null,
}: MapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const threeDView = use3DView(mapRef)
  const overlayRef = useRef<MapboxOverlay | null>(null)
  const progressRef = useRef(0)
  const heroPulseRef = useRef(0)
  const zoomRef = useRef(11)
  const zoomStageRef = useRef<ZoomStage>(getZoomStage(11))
  const interactionActiveRef = useRef(false)
  const viewportRafRef = useRef<number>(0)
  const [mapInstance, setMapInstance] = useState<maplibregl.Map | null>(null)
  const [hoveredNode, setHoveredNode] = useState<HoveredNode | null>(null)
  const [hoveredBarrier, setHoveredBarrier] = useState<HoveredBarrier | null>(null)
  const [hoveredFlow, setHoveredFlow] = useState<HoveredFlow | null>(null)
  const [hovered3D, setHovered3D] = useState<Hovered3D | null>(null)
  const is3DActive = threeDView.mode !== 'off'

  useEffect(() => {
    if (!is3DActive) setHovered3D(null)
  }, [is3DActive])
  const [closedDetailNodeId, setClosedDetailNodeId] = useState<string | null>(null)
  const selectedDistrictList = useMemo(
    () => [...(selectedDistricts ?? new Set<string>())].sort(),
    [selectedDistricts],
  )
  const { barriers } = useBarriers(selectedQuarter, selectedDistricts)
  const selectedBarrierNodeId = selectedNode?.id ?? null
  const [zoom, setZoom] = useState(11)
  const [viewportVersion, setViewportVersion] = useState(0)
  const [isViewportInteracting, setIsViewportInteracting] = useState(false)
  const [boundaries, setBoundaries] = useState<AdminBoundaryCollection | null>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [detailPanelWidth, setDetailPanelWidth] = useState(DETAIL_PANEL_DEFAULT_WIDTH)
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null)
  const [lastCluster, setLastCluster] = useState<DongCommerceCluster | null>(null)
  const detailPanelOpen = selectedNode !== null && closedDetailNodeId !== selectedNode.id
  const displayedNodeIds = useMemo(() => new Set(nodes.map((node) => node.id)), [nodes])
  const nodeDistrictMap = useMemo(
    () => new globalThis.Map(nodes.map((node) => [node.id, node.district])),
    [nodes],
  )
  const scopedBarriers = useMemo(() => (
    barriers.filter((barrier) =>
      displayedNodeIds.has(barrier.sourceId) || displayedNodeIds.has(barrier.targetId)
    )
  ), [barriers, displayedNodeIds])
  const selectedScopedBarriers = useMemo(() => (
    selectedBarrierNodeId
      ? scopedBarriers.filter((barrier) =>
          barrier.sourceId === selectedBarrierNodeId || barrier.targetId === selectedBarrierNodeId,
        )
      : []
  ), [scopedBarriers, selectedBarrierNodeId])
  const barrierRouteNodeId = selectedScopedBarriers.length > 0 ? selectedBarrierNodeId : null
  const { routes: barrierRoutes } = useBarrierRoutes(
    selectedQuarter,
    true,
    barrierRouteNodeId,
    selectedDistricts,
  )

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    markMapLoadStart()
    const apiKey = import.meta.env.VITE_VWORLD_API_KEY as string
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: theme === 'dark' ? CARTO_DARK_STYLE : VWORLD_LIGHT_STYLE(apiKey),
      // MVP 범위(강남·관악) 중심으로 초기 줌 — 페르소나(관악구 경제과 담당자) 동선
      // 기존 서울 중심(126.978, 37.566) → 강남·관악 결합 중심(약 127.0, 37.49)
      center: [127.0, 37.49],
      zoom: 11.5,
      minZoom: 9,
      maxZoom: 18,
      dragRotate: true,
      pitchWithRotate: true,
      touchPitch: true,
      maxPitch: 70,
    })

    const lightingEffect = new LightingEffect({
      ambient: new AmbientLight({ color: [255, 255, 255], intensity: 1.0 }),
      key: new DirectionalLight({
        color: [255, 240, 220],
        intensity: 1.6,
        direction: [-1, -2, -3],
      }),
      fill: new DirectionalLight({
        color: [180, 200, 255],
        intensity: 0.6,
        direction: [2, -1, -1],
      }),
    })
    const overlay = new MapboxOverlay({ interleaved: false, layers: [], effects: [lightingEffect] })
    map.addControl(overlay)
    overlayRef.current = overlay

    const syncZoomRef = () => {
      const z = map.getZoom()
      zoomRef.current = z
      return z
    }

    const syncZoomStage = (z: number, force = false) => {
      const nextStage = getZoomStage(z)
      if (force || nextStage !== zoomStageRef.current) {
        zoomStageRef.current = nextStage
        setZoom(z)
      }
      if (z < CANDIDATE_ZOOM) setHoveredNode(null)
    }

    const updateViewportPosition = () => {
      cancelAnimationFrame(viewportRafRef.current)
      viewportRafRef.current = requestAnimationFrame(() => {
        setViewportVersion(prev => prev + 1)
      })
    }

    const handleMove = () => {
      syncZoomRef()
    }

    const handleZoom = () => {
      syncZoomStage(syncZoomRef())
    }

    const handleInteractionStart = () => {
      interactionActiveRef.current = true
      setIsViewportInteracting(true)
      setHoveredNode(null)
    }

    const handleInteractionEnd = () => {
      interactionActiveRef.current = false
      setIsViewportInteracting(false)
      syncZoomStage(syncZoomRef())
      updateViewportPosition()
    }

    map.on('move', handleMove)
    map.on('zoom', handleZoom)
    map.on('movestart', handleInteractionStart)
    map.on('zoomstart', handleInteractionStart)
    map.on('moveend', handleInteractionEnd)
    map.on('zoomend', handleInteractionEnd)

    map.once('load', () => {
      markMapLoadEnd()
      mapRef.current = map
      syncZoomStage(syncZoomRef(), true)
      updateViewportPosition()
      setMapInstance(map)
    })

    return () => {
      map.off('move', handleMove)
      map.off('zoom', handleZoom)
      map.off('movestart', handleInteractionStart)
      map.off('zoomstart', handleInteractionStart)
      map.off('moveend', handleInteractionEnd)
      map.off('zoomend', handleInteractionEnd)
      cancelAnimationFrame(viewportRafRef.current)
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

  const handleNodeHover = useCallback((info: PickingInfo<CommerceNode>) => {
    if (info.object) {
      setHoveredNode({ node: info.object, x: info.x, y: info.y })
      setHoveredFlow(null)
    } else {
      setHoveredNode(null)
    }
  }, [])

  const handleFlowHover = useCallback((info: PickingInfo<{ flow: ODFlow }>) => {
    if (info.object) {
      setHoveredFlow({ flow: info.object.flow, x: info.x, y: info.y })
      setHoveredNode(null)
      setHoveredBarrier(null)
    } else {
      setHoveredFlow(null)
    }
  }, [])

  const handleNodeClick = useCallback((info: PickingInfo<CommerceNode>) => {
    onSelectNode?.(info.object ?? null)
    if (info.object) {
      setClosedDetailNodeId(null)
      setSelectedClusterId(null)
      setLastCluster(null)
    }
  }, [onSelectNode])

  const handleCommerceHover = useCallback((info: PickingInfo<{ name: string; value: number }>) => {
    if (info.object) {
      setHovered3D({
        title: info.object.name,
        subtitle: null,
        metric: threeDView.metric,
        value: info.object.value,
        x: info.x,
        y: info.y,
      })
    } else {
      setHovered3D(null)
    }
  }, [threeDView.metric])

  const colors = MAP_THEME[theme]
  const zoomStage = getZoomStage(zoom)
  const displayPolicy = useMemo(
    () => resolveCommerceDisplayPolicy({
      zoomStage,
      selectedDistrictCount: selectedDistrictList.length,
      totalDistrictCount: SEOUL_DISTRICT_NAMES.length,
      hasSelectedNode: selectedNode !== null,
    }),
    [selectedDistrictList.length, selectedNode, zoomStage],
  )
  const commerceLayerNodes = useMemo(() => {
    void viewportVersion
    if (displayPolicy.nodeScope === 'viewport') {
      return getNodesInViewport(nodes, mapInstance, selectedNode)
    }
    return nodes
  }, [displayPolicy.nodeScope, mapInstance, nodes, selectedNode, viewportVersion])
  const selectedFlowKey = selectedNode?.admKey ?? null
  const staticFlowLayer = useMemo(
    () => showFlows ? createODFlowLayer(flows, selectedFlowKey, handleFlowHover) : null,
    [flows, handleFlowHover, selectedFlowKey, showFlows],
  )
  const barrierRoutePathMap = useMemo(() => {
    const routeMap = new globalThis.Map<string, [number, number][]>()
    for (const route of barrierRoutes) {
      routeMap.set(route.barrierId, route.path)
      routeMap.set(`${route.sourceId}-${route.targetId}`, route.path)
    }
    return routeMap
  }, [barrierRoutes])
  const visibleBarriers = useMemo(() => {
    if (!showBarriers) return []
    const selectionOptions = {
      districts: selectedDistrictList,
      nodeDistrictMap,
    }
    if (!selectedBarrierNodeId || selectedScopedBarriers.length === 0) {
      return selectBalancedBarriers(scopedBarriers, OVERVIEW_BARRIER_LIMIT, selectionOptions)
    }
    return selectBalancedBarriers(selectedScopedBarriers, OVERVIEW_BARRIER_LIMIT, selectionOptions)
  }, [
    nodeDistrictMap,
    scopedBarriers,
    selectedBarrierNodeId,
    selectedDistrictList,
    selectedScopedBarriers,
    showBarriers,
  ])
  const barrierLayers = useMemo(
    () => visibleBarriers.length > 0 && barrierRoutePathMap.size > 0
      ? createFlowBarrierLayers(
          visibleBarriers,
          barrierRoutePathMap,
          (info) => {
            if (info.object) {
              setHoveredBarrier({ barrier: info.object.barrier, x: info.x, y: info.y })
              setHoveredFlow(null)
            } else {
              setHoveredBarrier(null)
            }
          },
        )
      : [],
    [barrierRoutePathMap, visibleBarriers],
  )
  const barrierSummary = useMemo(() => {
    const severityCounts: Record<BarrierSeverity, number> = { high: 0, medium: 0, low: 0 }
    let totalScore = 0
    let totalVolume = 0
    for (const barrier of visibleBarriers) {
      severityCounts[barrier.severity] += 1
      totalScore += barrier.score
      totalVolume += barrier.affectedVolume
    }
    return {
      severityCounts,
      avgScore: visibleBarriers.length > 0 ? totalScore / visibleBarriers.length : 0,
      totalVolume,
      topBarriers: [...visibleBarriers].sort((a, b) => b.score - a.score).slice(0, 3),
    }
  }, [visibleBarriers])
  const commerceLayers = useMemo(
    () => commerceLayerNodes.length > 0 && displayPolicy.showCommerceNodes && !is3DActive
      ? createCommerceNodeLayers(
          commerceLayerNodes,
          handleNodeHover,
          handleNodeClick,
          selectedNode?.id ?? null,
          advisorTiers,
        )
      : [],
    [commerceLayerNodes, displayPolicy.showCommerceNodes, handleNodeClick, handleNodeHover, selectedNode?.id, advisorTiers, is3DActive],
  )
  const threeDLayers = useMemo(() => {
    if (nodes.length === 0) return []
    const isAnimating = threeDView.extrudeProgress > 0
    const isCommerce = threeDView.mode === 'commerce' || (threeDView.mode === 'off' && isAnimating)

    if (isCommerce && threeDView.boundaries && threeDView.boundaries.length > 0) {
      return [
        createPolygonExtrusionLayer(nodes, threeDView.boundaries, threeDView.metric, threeDView.extrudeProgress, handleCommerceHover),
        createPolygonOutlineLayer(nodes, threeDView.boundaries, threeDView.metric, threeDView.extrudeProgress),
        createCommerceColumnLayer(nodes, threeDView.metric, 1, handleCommerceHover),
      ]
    }
    return []
  }, [threeDView.mode, threeDView.metric, threeDView.boundaries, threeDView.extrudeProgress, nodes, handleCommerceHover])

  const baseDeckLayers = useMemo(
    () => [
      ...commerceLayers,
      ...threeDLayers,
      ...(staticFlowLayer ? [staticFlowLayer] : []),
      ...barrierLayers,
    ],
    [barrierLayers, commerceLayers, staticFlowLayer, threeDLayers],
  )

  useEffect(() => {
    overlayRef.current?.setProps({ layers: baseDeckLayers })
  }, [baseDeckLayers, mapInstance])

  const handleFrame = useCallback((delta: number) => {
    if (!overlayRef.current || interactionActiveRef.current) return
    const animateFlow = showFlows
    const animateBarriers = visibleBarriers.length > 0 && barrierRoutePathMap.size > 0
    if (!animateFlow && !animateBarriers) return

    progressRef.current = (progressRef.current + getFlowProgressIncrement(delta)) % 1
    heroPulseRef.current += delta * 1000  // ms 단위 (createHeroPulseLayer elapsedMs 입력)

    const heroNode = heroNodeId ? nodes.find((n) => n.id === heroNodeId) ?? null : null
    const heroPulseLayer = createHeroPulseLayer(
      heroNode ? { node: heroNode, elapsedMs: heroPulseRef.current } : null,
    )

    const flowParticleLayer = animateFlow
      ? createFlowParticleLayer(flows, progressRef.current, selectedFlowKey, { zoom: zoomRef.current, flowStrength })
      : null

    const barrierParticleLayer = animateBarriers
      ? createDisruptedBarrierParticleLayer(
          visibleBarriers,
          progressRef.current,
          zoomRef.current,
          barrierRoutePathMap,
        )
      : null

    overlayRef.current.setProps({
      layers: [
        ...baseDeckLayers,
        ...(flowParticleLayer ? [flowParticleLayer] : []),
        ...(barrierParticleLayer ? [barrierParticleLayer] : []),
        ...(heroPulseLayer ? [heroPulseLayer] : []),
      ],
    })
  }, [barrierRoutePathMap, baseDeckLayers, flowStrength, flows, selectedFlowKey, showFlows, heroNodeId, nodes, visibleBarriers])

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

  useEffect(() => {
    if (!selectedNode || is3DActive) return
    setClosedDetailNodeId(null)
    setSelectedClusterId(null)
    focusCommerceNode(selectedNode)
  }, [focusCommerceNode, is3DActive, selectedNode])

  const handleDetailPanelResizeStart = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()

    const startX = event.clientX
    const startWidth = detailPanelWidth
    const availableWidth = containerSize.width || window.innerWidth
    const maxWidth = clamp(
      availableWidth - BARRIER_PANEL_WIDTH - LEFT_PANEL_GAP - 48,
      DETAIL_PANEL_MIN_WIDTH,
      DETAIL_PANEL_MAX_WIDTH,
    )
    const previousCursor = document.body.style.cursor
    const previousUserSelect = document.body.style.userSelect

    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const handleMove = (moveEvent: PointerEvent) => {
      const nextWidth = startWidth + moveEvent.clientX - startX
      setDetailPanelWidth(clamp(nextWidth, DETAIL_PANEL_MIN_WIDTH, maxWidth))
    }

    const handleUp = () => {
      document.body.style.cursor = previousCursor
      document.body.style.userSelect = previousUserSelect
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      window.removeEventListener('pointercancel', handleUp)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
    window.addEventListener('pointercancel', handleUp)
  }, [containerSize.width, detailPanelWidth])

  const districtClusters = useMemo(() => buildDistrictCommerceClusters(nodes), [nodes])
  const dongClusters = useMemo(() => buildDongCommerceClusters(nodes, boundaries), [nodes, boundaries])
  const clusters = useMemo(() => {
    if (displayPolicy.clusterLevel === 'district') return districtClusters
    if (displayPolicy.clusterLevel === 'dong') return dongClusters
    return []
  }, [displayPolicy.clusterLevel, districtClusters, dongClusters])
  const showClusters = !isViewportInteracting && clusters.length > 0
  const selectedCluster = useMemo(
    () => (
      clusters.find((cluster) => cluster.id === selectedClusterId)
      ?? (lastCluster?.id === selectedClusterId ? lastCluster : null)
    ),
    [clusters, lastCluster, selectedClusterId],
  )
  const handleBackToList = useCallback(() => {
    if (lastCluster) {
      setSelectedClusterId(lastCluster.id)
      setClosedDetailNodeId(selectedNode?.id ?? null)
      return
    }

    onSelectNode?.(null)
    setClosedDetailNodeId(null)
    setSelectedClusterId(null)
    setLastCluster(null)
  }, [lastCluster, onSelectNode, selectedNode?.id])
  const summaryText = buildSummaryText(purpose, hour, topN, ALL_COMMERCE_TYPES, nodes)
  const dataStatusTone = usingMockData ? '#FFCC80' : '#A5D6A7'
  const commerceBoundaryStatus = zoom >= 11 ? '상권 경계 표시 중' : '상권 경계: 확대하면 표시'
  const selectedDistrictCodes = useMemo(
    () => [...(selectedDistricts ?? new Set<string>())]
      .map((district) => SEOUL_DISTRICT_CODE_BY_NAME[district])
      .filter((code): code is string => Boolean(code)),
    [selectedDistricts],
  )
  const advisorBoundaryColors = useMemo(() => {
    const colorMap = new globalThis.Map<string, string>()
    if (!advisorTiers) return colorMap
    for (const [commCd, tier] of advisorTiers.entries()) {
      colorMap.set(commCd, getAdvisorColorHex(tier))
    }
    return colorMap
  }, [advisorTiers])
  const selectedBoundaryColor = useMemo(() => {
    if (!selectedNode) return null
    const tier = advisorTiers?.get(selectedNode.id)
    if (tier) return getAdvisorColorHex(tier)
    return deriveStartupSummary(selectedNode).fitColor
  }, [advisorTiers, selectedNode])

  const clusterPositions = useMemo((): ClusterPositionMap => {
    void viewportVersion
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
  }, [clusters, containerSize.height, containerSize.width, mapInstance, viewportVersion])

  function getClusterColor(cluster: DongCommerceCluster) {
    if (cluster.tone === 'recommended') return '#2563EB'
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
          <span style={{ color: '#93C5FD', fontWeight: 700 }}>추천 {cluster.recommendedCount}</span>
          <span>최고 {cluster.bestScore}</span>
          <span>목록 보기</span>
        </div>
      </button>
    )
  }

  function renderClusterPanel() {
    if (!selectedCluster) return null
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
                  setLastCluster(selectedCluster)
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

  function renderBarrierPanel() {
    if (!showBarriers) return null
    const hasBarriers = visibleBarriers.length > 0
    const usingOverviewFallback = Boolean(selectedBarrierNodeId && selectedScopedBarriers.length === 0)
    const leftPanelWidth = detailPanelOpen
      ? detailPanelWidth
      : selectedCluster
        ? CLUSTER_PANEL_WIDTH
        : 0
    const panelLeft = 16 + (leftPanelWidth > 0 ? leftPanelWidth + LEFT_PANEL_GAP : 0)

    return (
      <div
        style={{
          position: 'absolute',
          left: panelLeft,
          top: 64,
          zIndex: 17,
          width: BARRIER_PANEL_WIDTH,
          maxWidth: `calc(100% - ${panelLeft + 16}px)`,
          background: 'rgba(16,22,29,0.95)',
          border: `1px solid ${colors.panelBorder}`,
          borderRadius: 8,
          padding: 12,
          color: colors.panelText,
          boxShadow: '0 12px 28px rgba(0,0,0,0.34)',
          backdropFilter: 'blur(10px)',
          pointerEvents: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, lineHeight: 1.25 }}>
              단절 위험 감지
            </div>
            <div style={{ marginTop: 4, fontSize: 11, color: colors.secondaryText, lineHeight: 1.45 }}>
              매출 감소·폐업 위험·인접 상권 거리로 산출한 단절 위험 연결입니다.
            </div>
            {usingOverviewFallback && (
              <div style={{ marginTop: 5, fontSize: 10, color: '#FFCC80', lineHeight: 1.4 }}>
                선택한 상권에 직접 연결된 위험선이 없어 전체 단절 위험 구간을 유지합니다.
              </div>
            )}
          </div>
          <div
            style={{
              minWidth: 48,
              textAlign: 'right',
              color: '#FFCC80',
              fontSize: 20,
              fontWeight: 850,
              lineHeight: 1,
            }}
          >
            {visibleBarriers.length}
          </div>
        </div>

        {hasBarriers ? (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 7,
                marginTop: 12,
              }}
            >
              {(['high', 'medium', 'low'] as BarrierSeverity[]).map((severity) => {
                const meta = BARRIER_SEVERITY_META[severity]
                return (
                  <div
                    key={severity}
                    style={{
                      border: `1px solid ${meta.color}66`,
                      background: meta.bg,
                      borderRadius: 8,
                      padding: '7px 8px',
                    }}
                  >
                    <div style={{ fontSize: 10, color: meta.color, fontWeight: 800 }}>
                      {meta.label}
                    </div>
                    <div style={{ marginTop: 3, fontSize: 15, fontWeight: 850 }}>
                      {barrierSummary.severityCounts[severity]}
                    </div>
                  </div>
                )
              })}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                marginTop: 10,
              }}
            >
              <div style={{ background: 'rgba(21,29,38,0.86)', border: `1px solid ${colors.panelBorder}`, borderRadius: 8, padding: '8px 9px' }}>
                <div style={{ fontSize: 10, color: colors.mutedText }}>평균 단절 강도</div>
                <div style={{ marginTop: 3, fontSize: 15, fontWeight: 850, color: '#FFCC80' }}>
                  {(barrierSummary.avgScore * 100).toFixed(0)}%
                </div>
              </div>
              <div style={{ background: 'rgba(21,29,38,0.86)', border: `1px solid ${colors.panelBorder}`, borderRadius: 8, padding: '8px 9px' }}>
                <div style={{ fontSize: 10, color: colors.mutedText }}>영향 지수</div>
                <div style={{ marginTop: 3, fontSize: 15, fontWeight: 850 }}>
                  {formatBarrierVolume(barrierSummary.totalVolume)}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 12 }}>
              {barrierSummary.topBarriers.map((barrier) => {
                const meta = BARRIER_SEVERITY_META[barrier.severity]
                return (
                  <div
                    key={barrier.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '8px 1fr auto',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 9px',
                      background: 'rgba(21,29,38,0.88)',
                      border: `1px solid ${colors.panelBorder}`,
                      borderRadius: 8,
                    }}
                  >
                    <span style={{ width: 8, height: 32, borderRadius: 999, background: meta.color }} />
                    <span style={{ minWidth: 0 }}>
                      <span
                        style={{
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          fontSize: 11,
                          fontWeight: 750,
                        }}
                      >
                        {barrier.sourceName} → {barrier.targetName}
                      </span>
                      <span style={{ display: 'block', marginTop: 2, fontSize: 10, color: colors.mutedText }}>
                        영향 {formatBarrierVolume(barrier.affectedVolume)} · {meta.label}
                      </span>
                    </span>
                    <span style={{ color: meta.color, fontSize: 13, fontWeight: 850 }}>
                      {(barrier.score * 100).toFixed(0)}%
                    </span>
                  </div>
                )
              })}
            </div>

            <div style={{ marginTop: 10, fontSize: 10, color: colors.mutedText, lineHeight: 1.45 }}>
              현재 표시는 각 자치구 내부 또는 인접 상권의 매출·폐업 기반 단절 위험 구간입니다.
              지도에서 붉은 점선은 단절 위험이 높은 연결축이고, 퍼지는 입자는 위험 신호가 주변으로 번지는 구간입니다.
            </div>
          </>
        ) : (
          <div style={{ marginTop: 12, fontSize: 12, color: colors.secondaryText, lineHeight: 1.5 }}>
            현재 선택한 자치구와 줌 범위에서 표시할 단절 구간이 없습니다.
          </div>
        )}
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
        <>
          <AdminBoundaryLayer
            map={mapInstance}
            theme={theme}
            districtFilter={null}
            districtFilters={selectedDistrictCodes}
            fillOpacity={boundaryOpacity}
          />
          {threeDView.mode !== 'commerce' && (
            <CommerceBoundaryLayer
              map={mapInstance}
              theme={theme}
              selectedId={selectedNode?.id ?? null}
              selectedColor={selectedBoundaryColor}
              boundaryColors={advisorBoundaryColors}
              quarter={selectedQuarter}
              districts={[...(selectedDistricts ?? new Set<string>())]}
            />
          )}
        </>
      )}

      {!is3DActive && clusters.map(renderClusterBadge)}
      {!is3DActive && renderClusterPanel()}
      {renderBarrierPanel()}

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, whiteSpace: 'nowrap' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: colors.panelText }}>
            서울 창업 상권 지도
          </div>
          <div style={{ fontSize: 10, color: colors.secondaryText, fontWeight: 500 }}>
            업종·지역 후보를 고르고 위험 근거를 확인하세요
          </div>
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
          <span
            style={{
              background: zoom >= 11 ? 'rgba(46,125,50,0.24)' : 'rgba(21,29,38,0.95)',
              border: `1px solid ${zoom >= 11 ? 'rgba(123,208,141,0.55)' : colors.panelBorder}`,
              borderRadius: 999,
              padding: '3px 8px',
              fontSize: 10,
              color: zoom >= 11 ? '#A5D6A7' : colors.secondaryText,
            }}
          >
            {commerceBoundaryStatus}
          </span>
          {displayPolicy.statusLabel && (
            <span
              style={{
                background: 'rgba(37,99,235,0.18)',
                border: '1px solid rgba(147,197,253,0.48)',
                borderRadius: 999,
                padding: '3px 8px',
                fontSize: 10,
                color: '#BFDBFE',
              }}
            >
              {displayPolicy.statusLabel}
            </span>
          )}
        </div>
      </div>

      {!is3DActive && hoveredNode && (() => {
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

      {!is3DActive && hoveredFlow && (() => {
        const { flow, x, y } = hoveredFlow
        const containerWidth = containerSize.width || window.innerWidth
        const rawLeft = x + 14 + FLOW_HOVER_CARD_WIDTH > containerWidth
          ? x - 14 - FLOW_HOVER_CARD_WIDTH
          : x + 14
        const cardLeft = Math.max(0, rawLeft)
        const cardTop = Math.max(56, y - 12)
        const [r, g, b] = PURPOSE_COLORS[flow.purpose]
        const purposeColor = `rgb(${r}, ${g}, ${b})`
        const sourceName = getFlowEndpointName(flow.sourceNm, flow.sourceId)
        const targetName = getFlowEndpointName(flow.targetNm, flow.targetId)
        return (
          <div
            style={{
              position: 'absolute',
              left: cardLeft,
              top: cardTop,
              background: colors.panelBg,
              color: colors.panelText,
              border: `1px solid ${purposeColor}`,
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 12,
              pointerEvents: 'none',
              zIndex: 11,
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              width: FLOW_HOVER_CARD_WIDTH,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>OD 이동 흐름</span>
              <span
                style={{
                  background: `${purposeColor}22`,
                  color: purposeColor,
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: 4,
                  padding: '2px 6px',
                }}
              >
                {flow.purpose}
              </span>
            </div>
            <div style={{ fontSize: 12, color: colors.panelText, lineHeight: 1.45, marginBottom: 8 }}>
              <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {sourceName}
              </div>
              <div style={{ color: colors.mutedText, fontSize: 10, margin: '2px 0' }}>도착 방향</div>
              <div style={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {targetName}
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderTop: `1px solid ${colors.panelBorder}`, paddingTop: 8 }}>
              <div>
                <div style={{ fontSize: 10, color: colors.mutedText, marginBottom: 2 }}>이동량</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: purposeColor }}>{formatFlowVolume(flow.volume)}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: colors.mutedText, marginBottom: 2 }}>표시 기준</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: colors.secondaryText }}>{hour}시 · Top {topN}</div>
              </div>
            </div>
            <div style={{ marginTop: 8, color: colors.secondaryText, fontSize: 11, lineHeight: 1.4 }}>
              현재 시간대와 이동 목적 필터가 반영된 행정동 간 이동 경로입니다.
            </div>
          </div>
        )
      })()}

      {hoveredBarrier && (() => {
        const { barrier, x, y } = hoveredBarrier
        const containerWidth = containerSize.width || window.innerWidth
        const cardWidth = 240
        const rawLeft = x + 14 + cardWidth > containerWidth ? x - 14 - cardWidth : x + 14
        const cardLeft = Math.max(0, rawLeft)
        const cardTop = Math.max(56, y - 12)
        const severityColor =
          barrier.severity === 'high' ? '#EF5350'
          : barrier.severity === 'medium' ? '#F06292'
          : '#C084FC'
        const severityLabel =
          barrier.severity === 'high' ? '심각'
          : barrier.severity === 'medium' ? '주의' : '관찰'
        return (
          <div
            style={{
              position: 'absolute',
              left: cardLeft,
              top: cardTop,
              background: colors.panelBg,
              color: colors.panelText,
              border: `1px solid ${severityColor}`,
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 12,
              pointerEvents: 'none',
              zIndex: 11,
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
              width: cardWidth,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
              <span style={{ fontWeight: 700, fontSize: 13 }}>단절 위험</span>
              <span
                style={{
                  background: `${severityColor}22`,
                  color: severityColor,
                  fontSize: 10,
                  fontWeight: 700,
                  borderRadius: 4,
                  padding: '2px 6px',
                }}
              >
                {severityLabel}
              </span>
            </div>
            <div style={{ fontSize: 11, color: colors.secondaryText, lineHeight: 1.5, marginBottom: 6 }}>
              {barrier.sourceName} → {barrier.targetName}
            </div>
            {barrier.type && (
              <div style={{ fontSize: 11, color: colors.panelText, lineHeight: 1.4, marginBottom: 6 }}>
                {barrier.type}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: colors.mutedText }}>
              <span>영향 지수 {barrier.affectedVolume.toLocaleString()}</span>
              <span>점수 {barrier.score.toFixed(2)}</span>
            </div>
            <div style={{ marginTop: 6, color: '#FFCC80', fontSize: 11, fontWeight: 700 }}>
              단절 강도 {(barrier.score * 100).toFixed(0)}%
            </div>
          </div>
        )
      })()}

      {is3DActive && hovered3D && (() => {
        const { title, subtitle, metric, value, x, y } = hovered3D
        const containerWidth = containerSize.width || window.innerWidth
        const cardWidth = 220
        const rawLeft = x + 14 + cardWidth > containerWidth ? x - 14 - cardWidth : x + 14
        const cardLeft = Math.max(0, rawLeft)
        const cardTop = Math.max(56, y - 12)
        return (
          <div
            style={{
              position: 'absolute',
              left: cardLeft,
              top: cardTop,
              background: colors.panelBg,
              color: colors.panelText,
              border: `1px solid ${colors.panelBorder}`,
              borderRadius: 8,
              padding: '10px 14px',
              fontSize: 12,
              pointerEvents: 'none',
              zIndex: 12,
              boxShadow: '0 6px 18px rgba(0,0,0,0.5)',
              minWidth: 180,
              maxWidth: cardWidth,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 2 }}>
              {title}
            </div>
            {subtitle && (
              <div style={{ fontSize: 10, color: colors.mutedText, marginBottom: 6 }}>
                {subtitle}
              </div>
            )}
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                gap: 8,
                marginTop: subtitle ? 0 : 6,
                paddingTop: 6,
                borderTop: `1px solid ${colors.panelBorder}`,
              }}
            >
              <span style={{ fontSize: 11, color: colors.secondaryText }}>
                {getMetricLabel(metric)}
              </span>
              <span style={{ fontSize: 14, fontWeight: 800 }}>
                {formatMetricValue(value, metric)}
              </span>
            </div>
          </div>
        )
      })()}

      {!is3DActive && selectedNode && !detailPanelOpen && (
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

      {!is3DActive && detailPanelOpen && (
        <CommerceDetailPanel
          node={selectedNode}
          quarter={selectedQuarter}
          usingMockData={usingMockData}
          nodes={nodes}
          onClose={() => setClosedDetailNodeId(selectedNode?.id ?? null)}
          onBackToList={handleBackToList}
          panelWidth={detailPanelWidth}
          onResizeStart={handleDetailPanelResizeStart}
        />
      )}

      {containerSize.width >= 520 && (
        <ThreeDViewControl
          mode={threeDView.mode}
          metric={threeDView.metric}
          nodes={nodes}
          onModeChange={threeDView.setMode}
          onMetricChange={threeDView.setMetric}
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
