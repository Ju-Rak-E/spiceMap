import { describe, it, expect } from 'vitest'
import { getNextHour, getIntervalMs } from './useTimelineControl'

describe('getNextHour', () => {
  it('23 다음은 0으로 순환한다', () => {
    expect(getNextHour(23)).toBe(0)
  })

  it('일반 시간은 +1 진행한다', () => {
    expect(getNextHour(0)).toBe(1)
    expect(getNextHour(14)).toBe(15)
    expect(getNextHour(22)).toBe(23)
  })
})

describe('getIntervalMs', () => {
  it('1x 속도는 1000ms 간격이다', () => {
    expect(getIntervalMs(1)).toBe(1000)
  })

  it('2x 속도는 500ms 간격이다', () => {
    expect(getIntervalMs(2)).toBe(500)
  })

  it('4x 속도는 250ms 간격이다', () => {
    expect(getIntervalMs(4)).toBe(250)
  })
})
