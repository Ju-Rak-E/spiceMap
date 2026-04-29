import { describe, it, expect } from 'vitest'
import { hexToRgb, hexToRgba } from './colorUtils'

describe('hexToRgb', () => {
  it('parses #RRGGBB into [r, g, b]', () => {
    expect(hexToRgb('#FF0000')).toEqual([255, 0, 0])
    expect(hexToRgb('#00FF00')).toEqual([0, 255, 0])
    expect(hexToRgb('#0000FF')).toEqual([0, 0, 255])
  })

  it('parses lowercase hex', () => {
    expect(hexToRgb('#43a047')).toEqual([67, 160, 71])
  })

  it('parses mixed case hex from COMMERCE_COLORS tokens', () => {
    expect(hexToRgb('#E53935')).toEqual([229, 57, 53])
    expect(hexToRgb('#FB8C00')).toEqual([251, 140, 0])
    expect(hexToRgb('#9E9E9E')).toEqual([158, 158, 158])
    expect(hexToRgb('#424242')).toEqual([66, 66, 66])
    expect(hexToRgb('#43A047')).toEqual([67, 160, 71])
    expect(hexToRgb('#5C6F80')).toEqual([92, 111, 128])
  })

  it('handles black and white edges', () => {
    expect(hexToRgb('#000000')).toEqual([0, 0, 0])
    expect(hexToRgb('#FFFFFF')).toEqual([255, 255, 255])
  })
})

describe('hexToRgba', () => {
  it('appends alpha to RGB', () => {
    expect(hexToRgba('#E53935', 230)).toEqual([229, 57, 53, 230])
    expect(hexToRgba('#43A047', 255)).toEqual([67, 160, 71, 255])
  })

  it('clamps alpha to 0~255', () => {
    expect(hexToRgba('#000000', -10)).toEqual([0, 0, 0, 0])
    expect(hexToRgba('#FFFFFF', 999)).toEqual([255, 255, 255, 255])
  })
})
