import { describe, it, expect } from 'vitest'
import { getGriBorderColor, getGriBorderWidth } from './CommerceNodeLayer'

describe('commerce node outline style', () => {
  it('hides outlines for unselected nodes regardless of GRI', () => {
    expect(getGriBorderColor(80, false)).toEqual([0, 0, 0, 0])
    expect(getGriBorderColor(45, false)).toEqual([0, 0, 0, 0])
    expect(getGriBorderWidth(80, false)).toBe(0)
    expect(getGriBorderWidth(20, false)).toBe(0)
  })

  it('shows one consistent outline for the selected node', () => {
    expect(getGriBorderColor(90, true)).toEqual([123, 208, 141, 255])
    expect(getGriBorderWidth(10, true)).toBe(90)
  })
})
