import { describe, it, expect } from 'vitest'
import { MAP_THEME } from '../styles/tokens'
import { getBoundaryPaintConfig, getFillOpacityZoomExpr } from './boundaryLayerConfig'

describe('getBoundaryPaintConfig', () => {
  describe('light 테마', () => {
    const config = getBoundaryPaintConfig('light')

    it('경계선 색상이 light 토큰과 일치해야 한다', () => {
      expect(config.line['line-color']).toBe(MAP_THEME.light.boundaryLine)
    })

    it('하이라이트 색상이 light 토큰과 일치해야 한다', () => {
      expect(config.highlight['line-color']).toBe(MAP_THEME.light.highlightLine)
    })
  })

  describe('dark 테마', () => {
    const config = getBoundaryPaintConfig('dark')

    it('경계선 색상이 dark 토큰과 일치해야 한다', () => {
      expect(config.line['line-color']).toBe(MAP_THEME.dark.boundaryLine)
    })

    it('하이라이트 색상이 dark 토큰과 일치해야 한다', () => {
      expect(config.highlight['line-color']).toBe(MAP_THEME.dark.highlightLine)
    })

    it('dark 하이라이트가 light 하이라이트와 달라야 한다', () => {
      const light = getBoundaryPaintConfig('light')
      expect(config.highlight['line-color']).not.toBe(light.highlight['line-color'])
    })

    it('dark 경계선이 light 경계선과 달라야 한다', () => {
      const light = getBoundaryPaintConfig('light')
      expect(config.line['line-color']).not.toBe(light.line['line-color'])
    })
  })

  describe('공통 속성', () => {
    it('경계선 두께가 zoom interpolate 표현식이어야 한다', () => {
      expect(Array.isArray(getBoundaryPaintConfig('light').line['line-width'])).toBe(true)
      expect(Array.isArray(getBoundaryPaintConfig('dark').line['line-width'])).toBe(true)
    })

    it('하이라이트 두께가 고정 숫자여야 한다', () => {
      const config = getBoundaryPaintConfig('light')
      expect(typeof config.highlight['line-width']).toBe('number')
    })

    it('fill opacity zoom 표현식은 zoom이 최상위 interpolate 입력이어야 한다', () => {
      const expr = getFillOpacityZoomExpr(0.2)
      expect(expr[0]).toBe('interpolate')
      expect(expr[2]).toEqual(['zoom'])
      expect(expr[4]).toBeCloseTo(0)
      expect(expr[6]).toBeCloseTo(0.016)
      expect(expr[8]).toBeCloseTo(0.044)
      expect(expr[10]).toBeCloseTo(0.016)
    })
  })
})
