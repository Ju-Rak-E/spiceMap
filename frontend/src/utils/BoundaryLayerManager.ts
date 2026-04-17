import maplibregl from 'maplibre-gl'
import { MAP_THEME, type MapTheme } from '../styles/tokens'
import { getBoundaryPaintConfig } from './boundaryLayerConfig'

const SOURCE_ID = 'admin-boundary'
const FILL_LAYER_ID = 'admin-boundary-fill'
const LINE_LAYER_ID = 'admin-boundary-line'
const HIGHLIGHT_LAYER_ID = 'admin-boundary-highlight'

const MVP_GU_CODES = ['1123', '1121']

const buildHighlightFilter = (
  districtFilter: string | null,
): maplibregl.FilterSpecification => ([
  'in',
  ['get', 'gu_code'],
  ['literal', districtFilter ? [districtFilter] : MVP_GU_CODES],
])

export class BoundaryLayerManager {
  private readonly map: maplibregl.Map
  private theme: MapTheme
  private districtFilter: string | null
  private fillOpacity: number
  private readonly handleStyleData: () => void

  constructor(
    map: maplibregl.Map,
    theme: MapTheme,
    districtFilter: string | null = null,
    fillOpacity = 0.3,
  ) {
    this.map = map
    this.theme = theme
    this.districtFilter = districtFilter
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

  setDistrictFilter(districtFilter: string | null) {
    this.districtFilter = districtFilter
    this.syncLayers()
  }

  setFillOpacity(opacity: number) {
    this.fillOpacity = opacity
    if (this.map.getLayer(FILL_LAYER_ID)) {
      this.map.setPaintProperty(FILL_LAYER_ID, 'fill-opacity', opacity)
    }
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
      paint: { 'fill-color': fillColor, 'fill-opacity': this.fillOpacity },
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
    const paint = getBoundaryPaintConfig(this.theme)

    if (this.map.getLayer(FILL_LAYER_ID)) {
      this.map.setPaintProperty(FILL_LAYER_ID, 'fill-color', MAP_THEME[this.theme].boundaryFill)
      this.map.setPaintProperty(FILL_LAYER_ID, 'fill-opacity', this.fillOpacity)
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
  }

  private applyHighlightFilter() {
    if (!this.map.getLayer(HIGHLIGHT_LAYER_ID)) return
    this.map.setFilter(HIGHLIGHT_LAYER_ID, buildHighlightFilter(this.districtFilter))
  }

  private removeLayers() {
    if (this.map.getLayer(HIGHLIGHT_LAYER_ID)) this.map.removeLayer(HIGHLIGHT_LAYER_ID)
    if (this.map.getLayer(LINE_LAYER_ID)) this.map.removeLayer(LINE_LAYER_ID)
    if (this.map.getLayer(FILL_LAYER_ID)) this.map.removeLayer(FILL_LAYER_ID)
    if (this.map.getSource(SOURCE_ID)) this.map.removeSource(SOURCE_ID)
  }
}
