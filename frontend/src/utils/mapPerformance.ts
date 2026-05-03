export const MAP_LOAD_START_MARK = 'spicemap:map-load-start'
export const MAP_LOAD_END_MARK = 'spicemap:map-load-end'
export const MAP_LOAD_MEASURE = 'spicemap:map-load'

function getPerformance(): Performance | null {
  return typeof performance === 'undefined' ? null : performance
}

export function markMapLoadStart(): void {
  getPerformance()?.mark?.(MAP_LOAD_START_MARK)
}

export function markMapLoadEnd(): void {
  const perf = getPerformance()
  if (!perf?.mark || !perf.measure) return

  perf.mark(MAP_LOAD_END_MARK)
  try {
    perf.measure(MAP_LOAD_MEASURE, MAP_LOAD_START_MARK, MAP_LOAD_END_MARK)
  } catch {
    // If the start mark was cleared externally, keep map rendering unaffected.
  }
}
