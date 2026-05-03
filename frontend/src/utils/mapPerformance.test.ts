import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  MAP_LOAD_END_MARK,
  MAP_LOAD_MEASURE,
  MAP_LOAD_START_MARK,
  markMapLoadEnd,
  markMapLoadStart,
} from './mapPerformance'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('mapPerformance', () => {
  it('marks map load start', () => {
    const mark = vi.spyOn(performance, 'mark').mockImplementation((name) => ({ name }) as PerformanceMark)

    markMapLoadStart()

    expect(mark).toHaveBeenCalledWith(MAP_LOAD_START_MARK)
  })

  it('marks and measures map load end', () => {
    const mark = vi.spyOn(performance, 'mark').mockImplementation((name) => ({ name }) as PerformanceMark)
    const measure = vi.spyOn(performance, 'measure').mockImplementation((name) => ({ name }) as PerformanceMeasure)

    markMapLoadEnd()

    expect(mark).toHaveBeenCalledWith(MAP_LOAD_END_MARK)
    expect(measure).toHaveBeenCalledWith(MAP_LOAD_MEASURE, MAP_LOAD_START_MARK, MAP_LOAD_END_MARK)
  })
})
