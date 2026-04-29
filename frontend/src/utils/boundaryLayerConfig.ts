import { MAP_THEME, type MapTheme } from '../styles/tokens'

type MaplibreExpression = unknown[]

export interface BoundaryPaintConfig {
  line: {
    'line-color': string
    'line-width': number | MaplibreExpression
    'line-opacity': number
  }
  highlight: {
    'line-color': string
    'line-width': number | MaplibreExpression
    'line-opacity': number
  }
}

// zoom 10 → 0.4px, zoom 13 → 1.2px, zoom 16 → 2.5px
const LINE_WIDTH_ZOOM_EXPR: MaplibreExpression = [
  'interpolate', ['linear'], ['zoom'],
  10, 0.4,
  13, 1.2,
  16, 2.5,
]

export function getBoundaryPaintConfig(theme: MapTheme): BoundaryPaintConfig {
  const colors = MAP_THEME[theme]
  return {
    line: {
      'line-color': colors.boundaryLine,
      'line-width': LINE_WIDTH_ZOOM_EXPR,
      'line-opacity': 0.7,
    },
    highlight: {
      'line-color': colors.highlightLine,
      'line-width': 2,
      'line-opacity': 0.9,
    },
  }
}

// zoom 10 → 0.15, zoom 14+ → 0.25
export const FILL_OPACITY_ZOOM_EXPR: MaplibreExpression = [
  'interpolate', ['linear'], ['zoom'],
  10, 0.15,
  14, 0.25,
]
