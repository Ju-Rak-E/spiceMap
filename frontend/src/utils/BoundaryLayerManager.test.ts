import { describe, expect, it, vi } from 'vitest'
import { MAP_THEME } from '../styles/tokens'
import { BoundaryLayerManager } from './BoundaryLayerManager'

const LINE_LAYER_ID = 'admin-boundary-line'
const HIGHLIGHT_FILL_LAYER_ID = 'admin-boundary-highlight-fill'
const HIGHLIGHT_LAYER_ID = 'admin-boundary-highlight'

function createMockMap(styleLoaded = true) {
  const handlers: Record<string, Set<() => void>> = {}
  const layers = new Set<string>()
  let hasSource = false

  const map = {
    getSource: vi.fn().mockImplementation(() => (hasSource ? {} : null)),
    addSource: vi.fn().mockImplementation(() => {
      hasSource = true
    }),
    addLayer: vi.fn().mockImplementation((layer: { id: string }) => {
      layers.add(layer.id)
    }),
    removeLayer: vi.fn().mockImplementation((id: string) => {
      layers.delete(id)
    }),
    removeSource: vi.fn().mockImplementation(() => {
      hasSource = false
    }),
    getLayer: vi.fn().mockImplementation((id: string) => (layers.has(id) ? {} : null)),
    isStyleLoaded: vi.fn().mockReturnValue(styleLoaded),
    setFilter: vi.fn(),
    setPaintProperty: vi.fn(),
    on: vi.fn().mockImplementation((event: string, fn: () => void) => {
      if (!handlers[event]) handlers[event] = new Set()
      handlers[event].add(fn)
    }),
    off: vi.fn().mockImplementation((event: string, fn: () => void) => {
      handlers[event]?.delete(fn)
    }),
  }

  const emit = (event: string) => {
    handlers[event]?.forEach(fn => fn())
  }

  const resetStyle = () => {
    hasSource = false
    layers.clear()
  }

  return { map, emit, resetStyle }
}

describe('BoundaryLayerManager', () => {
  it('adds the source and layers immediately when the style is ready', () => {
    const { map } = createMockMap(true)

    new BoundaryLayerManager(map as never, 'light')

    expect(map.addSource).toHaveBeenCalledOnce()
    expect(map.addLayer).toHaveBeenCalledTimes(4)
  })

  it('restores layers with the latest dark theme after async style load', () => {
    const { map, emit } = createMockMap(false)

    const manager = new BoundaryLayerManager(map as never, 'light')
    manager.setTheme('dark')

    expect(map.addLayer).not.toHaveBeenCalled()

    map.isStyleLoaded.mockReturnValue(true)
    emit('styledata')

    const lineCall = map.addLayer.mock.calls.find(([layer]) => layer.id === LINE_LAYER_ID)
    const highlightCall = map.addLayer.mock.calls.find(([layer]) => layer.id === HIGHLIGHT_LAYER_ID)

    expect(lineCall?.[0].paint['line-color']).toBe(MAP_THEME.dark.boundaryLine)
    expect(highlightCall?.[0].paint['line-color']).toBe(MAP_THEME.dark.highlightLine)
  })

  it('updates paint properties immediately when the theme changes', () => {
    const { map } = createMockMap(true)

    const manager = new BoundaryLayerManager(map as never, 'light')
    map.setPaintProperty.mockClear()

    manager.setTheme('dark')

    expect(map.setPaintProperty).toHaveBeenCalledWith(
      LINE_LAYER_ID,
      'line-color',
      MAP_THEME.dark.boundaryLine,
    )
    expect(map.setPaintProperty).toHaveBeenCalledWith(
      HIGHLIGHT_LAYER_ID,
      'line-color',
      MAP_THEME.dark.highlightLine,
    )
  })

  it('districtFilter가 null이면 하이라이트 필터를 빈 배열로 설정한다', () => {
    const { map, emit } = createMockMap(false)

    new BoundaryLayerManager(map as never, 'light', null)

    map.isStyleLoaded.mockReturnValue(true)
    emit('styledata')

    const highlightCall = map.addLayer.mock.calls.find(([layer]) => layer.id === HIGHLIGHT_LAYER_ID)
    expect(highlightCall?.[0].filter).toEqual([
      'in',
      ['get', 'gu_code'],
      ['literal', []],
    ])
  })

  it('uses the latest district filter when layers are recreated', () => {
    const { map, emit } = createMockMap(false)

    const manager = new BoundaryLayerManager(map as never, 'light')
    manager.setDistrictFilter('11680')

    map.isStyleLoaded.mockReturnValue(true)
    emit('styledata')

    const highlightCall = map.addLayer.mock.calls.find(([layer]) => layer.id === HIGHLIGHT_LAYER_ID)
    expect(highlightCall?.[0].filter).toEqual([
      'in',
      ['get', 'gu_code'],
      ['literal', ['11680']],
    ])
  })

  it('recreates layers on idle after setStyle clears them', () => {
    const { map, emit, resetStyle } = createMockMap(true)

    new BoundaryLayerManager(map as never, 'dark')
    expect(map.addLayer).toHaveBeenCalledTimes(4)

    resetStyle()
    map.addLayer.mockClear()
    emit('idle')

    expect(map.addLayer).toHaveBeenCalledTimes(4)
    const highlightCall = map.addLayer.mock.calls.find(([layer]) => layer.id === HIGHLIGHT_LAYER_ID)
    expect(highlightCall?.[0].paint['line-color']).toBe(MAP_THEME.dark.highlightLine)
  })

  it('applies the latest district filter to highlight fill and line layers', () => {
    const { map } = createMockMap(true)

    const manager = new BoundaryLayerManager(map as never, 'light')
    map.setFilter.mockClear()

    manager.setDistrictFilter(['1123', '1121'])

    const expectedFilter = [
      'in',
      ['get', 'gu_code'],
      ['literal', ['1123', '1121']],
    ]
    expect(map.setFilter).toHaveBeenCalledWith(HIGHLIGHT_FILL_LAYER_ID, expectedFilter)
    expect(map.setFilter).toHaveBeenCalledWith(HIGHLIGHT_LAYER_ID, expectedFilter)
  })

  it('does not recreate layers after destroy', () => {
    const { map, emit, resetStyle } = createMockMap(true)

    const manager = new BoundaryLayerManager(map as never, 'light')
    manager.destroy()

    resetStyle()
    map.addSource.mockClear()
    map.addLayer.mockClear()
    emit('styledata')

    expect(map.addSource).not.toHaveBeenCalled()
    expect(map.addLayer).not.toHaveBeenCalled()
  })
})
