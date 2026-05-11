import { describe, expect, it, vi } from 'vitest'
import { CommerceBoundaryLayerManager } from './CommerceBoundaryLayerManager'

const LINE_LAYER_ID = 'commerce-boundary-line'
const FILL_LAYER_ID = 'commerce-boundary-fill'
const LINE_GLOW_LAYER_ID = 'commerce-boundary-line-glow'
const SELECTED_FILL_LAYER_ID = 'commerce-boundary-selected-fill'
const SELECTED_LINE_LAYER_ID = 'commerce-boundary-selected-line'

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

  return { map, emit }
}

describe('CommerceBoundaryLayerManager', () => {
  it('adds mock commerce boundary source and four layers when style is ready', () => {
    const { map } = createMockMap(true)

    new CommerceBoundaryLayerManager(map as never, 'dark', 'gc_001')

    expect(map.addSource).toHaveBeenCalledWith('commerce-boundary', {
      type: 'geojson',
      data: '/data/mock_commerce_boundary.geojson',
    })
    expect(map.addLayer).toHaveBeenCalledTimes(5)
    expect(map.addLayer.mock.calls.some(([layer]) => layer.id === LINE_GLOW_LAYER_ID)).toBe(true)
  })

  it('waits for styledata before adding layers', () => {
    const { map, emit } = createMockMap(false)

    new CommerceBoundaryLayerManager(map as never, 'dark')
    expect(map.addLayer).not.toHaveBeenCalled()

    map.isStyleLoaded.mockReturnValue(true)
    emit('styledata')

    expect(map.addLayer).toHaveBeenCalledTimes(5)
  })

  it('applies selected commerce filter to selected fill and line layers', () => {
    const { map } = createMockMap(true)
    const manager = new CommerceBoundaryLayerManager(map as never, 'dark')
    map.setFilter.mockClear()

    manager.setSelectedId('gw_003')

    const expectedFilter = [
      'any',
      ['in', ['get', 'comm_id'], ['literal', ['gw_003']]],
      ['in', ['get', 'comm_cd'], ['literal', ['gw_003']]],
    ]
    expect(map.setFilter).toHaveBeenCalledWith(SELECTED_FILL_LAYER_ID, expectedFilter)
    expect(map.setFilter).toHaveBeenCalledWith(SELECTED_LINE_LAYER_ID, expectedFilter)
  })

  it('updates line color when theme changes', () => {
    const { map } = createMockMap(true)
    const manager = new CommerceBoundaryLayerManager(map as never, 'dark')

    manager.setTheme('light')

    expect(map.setPaintProperty).toHaveBeenCalledWith(LINE_LAYER_ID, 'line-color', '#263238')
  })

  it('updates selected boundary color from the active card tone', () => {
    const { map } = createMockMap(true)
    const manager = new CommerceBoundaryLayerManager(map as never, 'dark')
    map.setPaintProperty.mockClear()

    manager.setSelectedColor('#E53935')

    expect(map.setPaintProperty).toHaveBeenCalledWith(SELECTED_FILL_LAYER_ID, 'fill-color', '#E53935')
    expect(map.setPaintProperty).toHaveBeenCalledWith(SELECTED_LINE_LAYER_ID, 'line-color', '#E53935')
  })

  it('uses advisor colors for matching commerce boundary lines', () => {
    const { map } = createMockMap(true)
    const manager = new CommerceBoundaryLayerManager(map as never, 'dark')
    map.setPaintProperty.mockClear()

    manager.setBoundaryColors(new Map([['gc_002', '#D97706']]))

    const lineColorCall = map.setPaintProperty.mock.calls.find(
      ([layerId, property]) => layerId === LINE_LAYER_ID && property === 'line-color',
    )
    expect(JSON.stringify(lineColorCall?.[2])).toContain('#D97706')
    expect(JSON.stringify(lineColorCall?.[2])).toContain('gc_002')
  })

  it('rounds commerce boundary line joins and caps', () => {
    const { map } = createMockMap(true)

    new CommerceBoundaryLayerManager(map as never, 'dark')

    const lineCall = map.addLayer.mock.calls.find(([layer]) => layer.id === LINE_LAYER_ID)
    const selectedLineCall = map.addLayer.mock.calls.find(([layer]) => layer.id === SELECTED_LINE_LAYER_ID)
    expect(lineCall?.[0].layout).toEqual({ 'line-join': 'round', 'line-cap': 'round' })
    expect(selectedLineCall?.[0].layout).toEqual({ 'line-join': 'round', 'line-cap': 'round' })
  })

  it('updates GeoJSON source data when API boundary data arrives', () => {
    const { map } = createMockMap(true)
    const setData = vi.fn()
    map.getSource.mockReturnValue({ setData })
    const manager = new CommerceBoundaryLayerManager(map as never, 'dark')
    const data = { type: 'FeatureCollection' as const, features: [] }

    manager.setData(data)

    expect(setData).toHaveBeenCalledWith(data)
  })

  it('recreates missing layers while keeping the existing source', () => {
    const { map, emit } = createMockMap(true)

    new CommerceBoundaryLayerManager(map as never, 'dark', 'gc_001')
    map.addSource.mockClear()
    map.addLayer.mockClear()

    map.removeLayer(SELECTED_LINE_LAYER_ID)
    map.removeLayer(SELECTED_FILL_LAYER_ID)
    map.removeLayer(LINE_LAYER_ID)
    map.removeLayer(LINE_GLOW_LAYER_ID)
    map.removeLayer(FILL_LAYER_ID)
    emit('idle')

    expect(map.addSource).not.toHaveBeenCalled()
    expect(map.addLayer).toHaveBeenCalledTimes(5)
  })
})
