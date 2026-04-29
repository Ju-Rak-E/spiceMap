import maplibregl from 'maplibre-gl'
import { MAP_THEME, type MapTheme } from '../styles/tokens'
import { getBoundaryPaintConfig, getFillOpacityZoomExpr } from './boundaryLayerConfig'

const SOURCE_ID = 'admin-boundary'
const FILL_LAYER_ID = 'admin-boundary-fill'
const HIGHLIGHT_FILL_LAYER_ID = 'admin-boundary-highlight-fill'
const LINE_LAYER_ID = 'admin-boundary-line'
const HIGHLIGHT_LAYER_ID = 'admin-boundary-highlight'

type DistrictFilter = string | string[] | null

function normalizeDistrictFilter(districtFilter: DistrictFilter): string[] {
  if (districtFilter === null) return []
  return Array.isArray(districtFilter) ? districtFilter : [districtFilter]
}

const buildHighlightFilter = (
  districtFilter: DistrictFilter,
): maplibregl.FilterSpecification => ([
  'in',
  ['get', 'gu_code'],
  ['literal', normalizeDistrictFilter(districtFilter)],
])

export class BoundaryLayerManager {
  private readonly map: maplibregl.Map
  private theme: MapTheme
  private districtFilter: string[]
  private fillOpacity: number
  private readonly handleStyleData: () => void

  constructor(
    map: maplibregl.Map,
    theme: MapTheme,
    districtFilter: DistrictFilter = null,
    fillOpacity = 0.3,
  ) {
    this.map = map
    this.theme = theme
    this.districtFilter = normalizeDistrictFilter(districtFilter)
    this.fillOpacity = fillOpacity
    this.handleStyleData = () => {
      this.syncLayers()
    }

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
    this.syncLayers()
  }

  setDistrictFilter(districtFilter: DistrictFilter) {
    this.districtFilter = normalizeDistrictFilter(districtFilter)
    this.syncLayers()
  }

  setFillOpacity(opacity: number) {
    this.fillOpacity = opacity
    this.updatePaint()
  }

  private syncLayers() {
    if (!this.map.isStyleLoaded()) return

    if (!this.map.getSource(SOURCE_ID)) {
      this.addLayers()
      return
    }

    this.updatePaint()
    this.applyHighlightFilter()
  }

  private addLayers() {
    const paint = getBoundaryPaintConfig(this.theme)

    this.map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: '/data/seoul_admin_boundary.geojson',
    })

    const fillColor = MAP_THEME[this.theme].boundaryFill
    this.map.addLayer({
      id: FILL_LAYER_ID,
      type: 'fill',
      source: SOURCE_ID,
      paint: {
        'fill-color': fillColor,
        'fill-opacity': getFillOpacityZoomExpr(this.fillOpacity),
      },
    })

    this.map.addLayer({
      id: HIGHLIGHT_FILL_LAYER_ID,
      type: 'fill',
      source: SOURCE_ID,
      filter: buildHighlightFilter(this.districtFilter),
      paint: {
        'fill-color': '#1B5E20',
        'fill-opacity': [
          'interpolate', ['linear'], ['zoom'],
          9, 0.22,
          12.5, 0.34,
          15, 0.24,
        ],
      },
    })

    this.map.addLayer({
      id: LINE_LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      paint: paint.line,
    })

    this.map.addLayer({
      id: HIGHLIGHT_LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      filter: buildHighlightFilter(this.districtFilter),
      paint: paint.highlight,
    })
  }

  private updatePaint() {
    if (!this.map.isStyleLoaded()) return
    const paint = getBoundaryPaintConfig(this.theme)

    if (this.map.getLayer(FILL_LAYER_ID)) {
      this.map.setPaintProperty(FILL_LAYER_ID, 'fill-color', MAP_THEME[this.theme].boundaryFill)
      this.map.setPaintProperty(
        FILL_LAYER_ID,
        'fill-opacity',
        getFillOpacityZoomExpr(this.fillOpacity),
      )
    }

    if (this.map.getLayer(LINE_LAYER_ID)) {
      this.map.setPaintProperty(LINE_LAYER_ID, 'line-color', paint.line['line-color'])
      this.map.setPaintProperty(LINE_LAYER_ID, 'line-width', paint.line['line-width'])
      this.map.setPaintProperty(LINE_LAYER_ID, 'line-opacity', paint.line['line-opacity'])
    }

    if (this.map.getLayer(HIGHLIGHT_LAYER_ID)) {
      this.map.setPaintProperty(HIGHLIGHT_LAYER_ID, 'line-color', paint.highlight['line-color'])
      this.map.setPaintProperty(HIGHLIGHT_LAYER_ID, 'line-width', paint.highlight['line-width'])
      this.map.setPaintProperty(HIGHLIGHT_LAYER_ID, 'line-opacity', paint.highlight['line-opacity'])
    }

    if (this.map.getLayer(HIGHLIGHT_FILL_LAYER_ID)) {
      this.map.setPaintProperty(HIGHLIGHT_FILL_LAYER_ID, 'fill-color', '#1B5E20')
    }
  }

  private applyHighlightFilter() {
    const filter = buildHighlightFilter(this.districtFilter)
    if (this.map.getLayer(HIGHLIGHT_FILL_LAYER_ID)) {
      this.map.setFilter(HIGHLIGHT_FILL_LAYER_ID, filter)
    }
    if (this.map.getLayer(HIGHLIGHT_LAYER_ID)) {
      this.map.setFilter(HIGHLIGHT_LAYER_ID, filter)
    }
  }

  private removeLayers() {
    try {
      if (!this.map.isStyleLoaded()) return
      if (this.map.getLayer(HIGHLIGHT_LAYER_ID)) this.map.removeLayer(HIGHLIGHT_LAYER_ID)
      if (this.map.getLayer(LINE_LAYER_ID)) this.map.removeLayer(LINE_LAYER_ID)
      if (this.map.getLayer(HIGHLIGHT_FILL_LAYER_ID)) this.map.removeLayer(HIGHLIGHT_FILL_LAYER_ID)
      if (this.map.getLayer(FILL_LAYER_ID)) this.map.removeLayer(FILL_LAYER_ID)
      if (this.map.getSource(SOURCE_ID)) this.map.removeSource(SOURCE_ID)
    } catch {
      // The MapLibre style can be torn down before React effect cleanup runs.
    }
  }
}
