import maplibregl from 'maplibre-gl'
import { type MapTheme } from '../styles/tokens'

const SOURCE_ID = 'commerce-boundary'
const FILL_LAYER_ID = 'commerce-boundary-fill'
const LINE_GLOW_LAYER_ID = 'commerce-boundary-line-glow'
const LINE_LAYER_ID = 'commerce-boundary-line'
const SELECTED_FILL_LAYER_ID = 'commerce-boundary-selected-fill'
const SELECTED_LINE_LAYER_ID = 'commerce-boundary-selected-line'
const DATA_URL = '/data/mock_commerce_boundary.geojson'

const SELECTED_COLOR = '#7BD08D'
const MIN_VISIBLE_ZOOM = 10.5
const SELECTED_MIN_VISIBLE_ZOOM = 11.5
const BOUNDARY_LINE_LAYOUT = {
  'line-join': 'round',
  'line-cap': 'round',
} as const
type BoundaryData = NonNullable<maplibregl.GeoJSONSourceSpecification['data']>
export type BoundaryColorMap = ReadonlyMap<string, string>
type ColorPaint = string | maplibregl.ExpressionSpecification

function buildSelectedFilter(selectedId: string | null): maplibregl.FilterSpecification {
  const ids = selectedId ? [selectedId] : []
  return [
    'any',
    ['in', ['get', 'comm_id'], ['literal', ids]],
    ['in', ['get', 'comm_cd'], ['literal', ids]],
  ]
}

function lineColor(theme: MapTheme): string {
  return theme === 'dark' ? '#E8F1F5' : '#263238'
}

function buildBoundaryColorExpression(colors: BoundaryColorMap, fallback: string): ColorPaint {
  if (colors.size === 0) return fallback
  const matchPairs = [...colors.entries()].flatMap(([id, color]) => [id, color])
  return [
    'match',
    ['to-string', ['get', 'comm_cd']],
    ...matchPairs,
    [
      'match',
      ['to-string', ['get', 'comm_id']],
      ...matchPairs,
      fallback,
    ],
  ] as maplibregl.ExpressionSpecification
}

export class CommerceBoundaryLayerManager {
  private readonly map: maplibregl.Map
  private theme: MapTheme
  private selectedId: string | null
  private boundaryColors: BoundaryColorMap
  private selectedColor: string
  private data: BoundaryData
  private readonly handleStyleData: () => void

  constructor(
    map: maplibregl.Map,
    theme: MapTheme,
    selectedId: string | null = null,
    data: BoundaryData = DATA_URL,
    boundaryColors: BoundaryColorMap = new Map(),
    selectedColor: string | null = null,
  ) {
    this.map = map
    this.theme = theme
    this.selectedId = selectedId
    this.boundaryColors = boundaryColors
    this.selectedColor = selectedColor ?? SELECTED_COLOR
    this.data = data
    this.handleStyleData = () => this.syncLayers()

    this.map.on('styledata', this.handleStyleData)
    this.map.on('idle', this.handleStyleData)
    this.syncLayers()
  }

  destroy() {
    this.map.off('styledata', this.handleStyleData)
    this.map.off('idle', this.handleStyleData)
    this.removeLayers()
  }

  setTheme(theme: MapTheme) {
    this.theme = theme
    this.updatePaint()
  }

  setSelectedId(selectedId: string | null) {
    this.selectedId = selectedId
    this.applySelectedFilter()
  }

  setBoundaryColors(boundaryColors: BoundaryColorMap) {
    this.boundaryColors = boundaryColors
    this.updatePaint()
  }

  setSelectedColor(selectedColor: string | null) {
    this.selectedColor = selectedColor ?? SELECTED_COLOR
    this.updatePaint()
  }

  setData(data: BoundaryData) {
    this.data = data
    if (!this.map.isStyleLoaded()) return
    const source = this.map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    source?.setData(data)
  }

  private syncLayers() {
    if (!this.map.isStyleLoaded()) return

    if (!this.map.getSource(SOURCE_ID)) {
      this.addSource()
    }

    if (!this.hasAllLayers()) {
      this.removeLayerSet()
      this.addLayerSet()
    }

    this.updatePaint()
    this.applySelectedFilter()
  }

  private addSource() {
    this.map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: this.data,
    })
  }

  private hasAllLayers(): boolean {
    return Boolean(
      this.map.getLayer(FILL_LAYER_ID)
      && this.map.getLayer(LINE_GLOW_LAYER_ID)
      && this.map.getLayer(LINE_LAYER_ID)
      && this.map.getLayer(SELECTED_FILL_LAYER_ID)
      && this.map.getLayer(SELECTED_LINE_LAYER_ID),
    )
  }

  private addLayerSet() {
    this.map.addLayer({
      id: FILL_LAYER_ID,
      type: 'fill',
      source: SOURCE_ID,
      minzoom: MIN_VISIBLE_ZOOM,
      paint: {
        'fill-color': '#90A4AE',
        'fill-opacity': [
          'interpolate', ['linear'], ['zoom'],
          10.5, 0.02,
          12, 0.055,
          16, 0.13,
        ],
      },
    })

    this.map.addLayer({
      id: LINE_GLOW_LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      minzoom: MIN_VISIBLE_ZOOM,
      layout: BOUNDARY_LINE_LAYOUT,
      paint: {
        'line-color': buildBoundaryColorExpression(this.boundaryColors, lineColor(this.theme)),
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          10.5, 2.4,
          13, 3.4,
          16, 5,
        ],
        'line-opacity': [
          'interpolate', ['linear'], ['zoom'],
          10.5, 0.16,
          13, 0.22,
          16, 0.28,
        ],
      },
    })

    this.map.addLayer({
      id: LINE_LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      minzoom: MIN_VISIBLE_ZOOM,
      layout: BOUNDARY_LINE_LAYOUT,
      paint: {
        'line-color': buildBoundaryColorExpression(this.boundaryColors, lineColor(this.theme)),
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          10.5, 1.1,
          13, 1.8,
          15, 2.6,
          17, 3.4,
        ],
        'line-opacity': 0.98,
      },
    })

    this.map.addLayer({
      id: SELECTED_FILL_LAYER_ID,
      type: 'fill',
      source: SOURCE_ID,
      minzoom: SELECTED_MIN_VISIBLE_ZOOM,
      filter: buildSelectedFilter(this.selectedId),
      paint: {
        'fill-color': this.selectedColor,
        'fill-opacity': 0.2,
      },
    })

    this.map.addLayer({
      id: SELECTED_LINE_LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      minzoom: SELECTED_MIN_VISIBLE_ZOOM,
      filter: buildSelectedFilter(this.selectedId),
      layout: BOUNDARY_LINE_LAYOUT,
      paint: {
        'line-color': this.selectedColor,
        'line-width': 4,
        'line-opacity': 0.95,
      },
    })
  }

  private removeLayerSet() {
    if (this.map.getLayer(SELECTED_LINE_LAYER_ID)) this.map.removeLayer(SELECTED_LINE_LAYER_ID)
    if (this.map.getLayer(SELECTED_FILL_LAYER_ID)) this.map.removeLayer(SELECTED_FILL_LAYER_ID)
    if (this.map.getLayer(LINE_LAYER_ID)) this.map.removeLayer(LINE_LAYER_ID)
    if (this.map.getLayer(LINE_GLOW_LAYER_ID)) this.map.removeLayer(LINE_GLOW_LAYER_ID)
    if (this.map.getLayer(FILL_LAYER_ID)) this.map.removeLayer(FILL_LAYER_ID)
  }

  private updatePaint() {
    if (!this.map.isStyleLoaded()) return
    const boundaryLineColor = buildBoundaryColorExpression(this.boundaryColors, lineColor(this.theme))
    if (this.map.getLayer(LINE_GLOW_LAYER_ID)) {
      this.map.setPaintProperty(LINE_GLOW_LAYER_ID, 'line-color', boundaryLineColor)
    }
    if (this.map.getLayer(LINE_LAYER_ID)) {
      this.map.setPaintProperty(LINE_LAYER_ID, 'line-color', boundaryLineColor)
    }
    if (this.map.getLayer(SELECTED_FILL_LAYER_ID)) {
      this.map.setPaintProperty(SELECTED_FILL_LAYER_ID, 'fill-color', this.selectedColor)
    }
    if (this.map.getLayer(SELECTED_LINE_LAYER_ID)) {
      this.map.setPaintProperty(SELECTED_LINE_LAYER_ID, 'line-color', this.selectedColor)
    }
  }

  private applySelectedFilter() {
    if (!this.map.isStyleLoaded()) return
    const filter = buildSelectedFilter(this.selectedId)
    if (this.map.getLayer(SELECTED_FILL_LAYER_ID)) {
      this.map.setFilter(SELECTED_FILL_LAYER_ID, filter)
    }
    if (this.map.getLayer(SELECTED_LINE_LAYER_ID)) {
      this.map.setFilter(SELECTED_LINE_LAYER_ID, filter)
    }
  }

  private removeLayers() {
    try {
      if (!this.map.isStyleLoaded()) return
      this.removeLayerSet()
      if (this.map.getSource(SOURCE_ID)) this.map.removeSource(SOURCE_ID)
    } catch {
      // MapLibre can clear the style before React cleanup runs.
    }
  }
}
