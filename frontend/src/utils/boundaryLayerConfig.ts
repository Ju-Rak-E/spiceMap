import { MAP_THEME, type MapTheme } from '../styles/tokens'
import type { ExpressionSpecification } from 'maplibre-gl'

type MaplibreExpression = ExpressionSpecification

export interface BoundaryPaintConfig {
  line: {
    'line-color': string
    'line-width': number | MaplibreExpression
    'line-opacity': number | MaplibreExpression
  }
  highlight: {
    'line-color': string
    'line-width': number | MaplibreExpression
    'line-opacity': number | MaplibreExpression
  }
}

export const LINE_WIDTH_ZOOM_EXPR: MaplibreExpression = [
  'interpolate', ['linear'], ['zoom'],
  9, 0.2,
  10.5, 0.5,
  12.5, 1.4,
  14.5, 2.2,
]

export const LINE_OPACITY_ZOOM_EXPR: MaplibreExpression = [
  'interpolate', ['linear'], ['zoom'],
  9, 0.2,
  10.5, 0.35,
  12.5, 0.9,
  14.5, 0.6,
]

export function getBoundaryPaintConfig(theme: MapTheme): BoundaryPaintConfig {
  const colors = MAP_THEME[theme]
  return {
    line: {
      'line-color': colors.boundaryLine,
      'line-width': LINE_WIDTH_ZOOM_EXPR,
      'line-opacity': LINE_OPACITY_ZOOM_EXPR,
    },
    highlight: {
      'line-color': colors.highlightLine,
      'line-width': 2,
      'line-opacity': 0.9,
    },
  }
}

export const FILL_OPACITY_ZOOM_EXPR: MaplibreExpression = [
  'interpolate', ['linear'], ['zoom'],
  9, 0,
  10.5, 0.08,
  12.5, 0.22,
  14.5, 0.08,
]

export function getFillOpacityZoomExpr(opacity: number): MaplibreExpression {
  return [
    'interpolate', ['linear'], ['zoom'],
    9, 0,
    10.5, 0.08 * opacity,
    12.5, 0.22 * opacity,
    14.5, 0.08 * opacity,
  ]
}
