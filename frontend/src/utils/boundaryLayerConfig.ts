import { MAP_THEME, type MapTheme } from '../styles/tokens'

export interface BoundaryPaintConfig {
  line: {
    'line-color': string
    'line-width': number
    'line-opacity': number
  }
  highlight: {
    'line-color': string
    'line-width': number
    'line-opacity': number
  }
}

export function getBoundaryPaintConfig(theme: MapTheme): BoundaryPaintConfig {
  const colors = MAP_THEME[theme]
  return {
    line: {
      'line-color': colors.boundaryLine,
      'line-width': 0.8,
      'line-opacity': 0.7,
    },
    highlight: {
      'line-color': colors.highlightLine,
      'line-width': 2,
      'line-opacity': 0.9,
    },
  }
}
