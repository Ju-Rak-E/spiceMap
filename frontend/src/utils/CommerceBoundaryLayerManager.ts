import maplibregl from 'maplibre-gl'
import { type MapTheme } from '../styles/tokens'

const SOURCE_ID = 'commerce-boundary'
const FILL_LAYER_ID = 'commerce-boundary-fill'
const LINE_LAYER_ID = 'commerce-boundary-line'
const SELECTED_FILL_LAYER_ID = 'commerce-boundary-selected-fill'
const SELECTED_LINE_LAYER_ID = 'commerce-boundary-selected-line'
const DATA_URL = '/data/mock_commerce_boundary.geojson'

const SELECTED_COLOR = '#7BD08D'
type BoundaryData = NonNullable<maplibregl.GeoJSONSourceSpecification['data']>

function buildSelectedFilter(selectedId: string | null): maplibregl.FilterSpecification {
  const ids = selectedId ? [selectedId] : []
  return [
    'any',
    ['in', ['get', 'comm_id'], ['literal', ids]],
    ['in', ['get', 'comm_cd'], ['literal', ids]],
  ]
}

function lineColor(theme: MapTheme): string {
  return theme === 'dark' ? '#B0BEC5' : '#263238'
}

export class CommerceBoundaryLayerManager {
  private readonly map: maplibregl.Map
  private theme: MapTheme
  private selectedId: string | null
  private data: BoundaryData
  private readonly handleStyleData: () => void

  constructor(
    map: maplibregl.Map,
    theme: MapTheme,
    selectedId: string | null = null,
    data: BoundaryData = DATA_URL,
  ) {
    this.map = map
    this.theme = theme
    this.selectedId = selectedId
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

  setData(data: BoundaryData) {
    this.data = data
    if (!this.map.isStyleLoaded()) return
    const source = this.map.getSource(SOURCE_ID) as maplibregl.GeoJSONSource | undefined
    source?.setData(data)
  }

  private syncLayers() {
    if (!this.map.isStyleLoaded()) return

    if (!this.map.getSource(SOURCE_ID)) {
      this.addLayers()
      return
    }

    this.updatePaint()
    this.applySelectedFilter()
  }

  private addLayers() {
    this.map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: this.data,
    })

    this.map.addLayer({
      id: FILL_LAYER_ID,
      type: 'fill',
      source: SOURCE_ID,
      minzoom: 12,
      paint: {
        'fill-color': '#90A4AE',
        'fill-opacity': [
          'interpolate', ['linear'], ['zoom'],
          12, 0.04,
          13, 0.08,
          16, 0.14,
        ],
      },
    })

    this.map.addLayer({
      id: LINE_LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      minzoom: 12,
      paint: {
        'line-color': lineColor(this.theme),
        'line-width': [
          'interpolate', ['linear'], ['zoom'],
          13, 0.6,
          15, 1.4,
          17, 2.2,
        ],
        'line-opacity': 0.7,
      },
    })

    this.map.addLayer({
      id: SELECTED_FILL_LAYER_ID,
      type: 'fill',
      source: SOURCE_ID,
      minzoom: 12.5,
      filter: buildSelectedFilter(this.selectedId),
      paint: {
        'fill-color': SELECTED_COLOR,
        'fill-opacity': 0.2,
      },
    })

    this.map.addLayer({
      id: SELECTED_LINE_LAYER_ID,
      type: 'line',
      source: SOURCE_ID,
      minzoom: 12.5,
      filter: buildSelectedFilter(this.selectedId),
      paint: {
        'line-color': SELECTED_COLOR,
        'line-width': 3,
        'line-opacity': 0.95,
      },
    })
  }

  private updatePaint() {
    if (!this.map.isStyleLoaded()) return
    if (this.map.getLayer(LINE_LAYER_ID)) {
      this.map.setPaintProperty(LINE_LAYER_ID, 'line-color', lineColor(this.theme))
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
      if (this.map.getLayer(SELECTED_LINE_LAYER_ID)) this.map.removeLayer(SELECTED_LINE_LAYER_ID)
      if (this.map.getLayer(SELECTED_FILL_LAYER_ID)) this.map.removeLayer(SELECTED_FILL_LAYER_ID)
      if (this.map.getLayer(LINE_LAYER_ID)) this.map.removeLayer(LINE_LAYER_ID)
      if (this.map.getLayer(FILL_LAYER_ID)) this.map.removeLayer(FILL_LAYER_ID)
      if (this.map.getSource(SOURCE_ID)) this.map.removeSource(SOURCE_ID)
    } catch {
      // MapLibre can clear the style before React cleanup runs.
    }
  }
}
