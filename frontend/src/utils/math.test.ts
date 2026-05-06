import { describe, expect, it } from 'vitest'
import { clamp } from './math'

describe('clamp', () => {
  it('returns value when within range', () => {
    expect(clamp(2, 0, 3)).toBe(2)
  })

  it('clamps to min when below range', () => {
    expect(clamp(-1, 0, 3)).toBe(0)
  })

  it('clamps to max when above range', () => {
    expect(clamp(5, 0, 3)).toBe(3)
  })

  it('returns min when value equals min', () => {
    expect(clamp(0, 0, 3)).toBe(0)
  })

  it('returns max when value equals max', () => {
    expect(clamp(3, 0, 3)).toBe(3)
  })
})
