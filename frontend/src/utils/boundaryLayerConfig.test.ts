import { describe, it, expect } from 'vitest'
import { MAP_THEME } from '../styles/tokens'
import { getBoundaryPaintConfig } from './boundaryLayerConfig'

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
    it('경계선 두께가 양수여야 한다', () => {
      expect(getBoundaryPaintConfig('light').line['line-width']).toBeGreaterThan(0)
      expect(getBoundaryPaintConfig('dark').line['line-width']).toBeGreaterThan(0)
    })

    it('하이라이트가 경계선보다 두꺼워야 한다', () => {
      const config = getBoundaryPaintConfig('light')
      expect(config.highlight['line-width']).toBeGreaterThan(config.line['line-width'])
    })
  })
})
