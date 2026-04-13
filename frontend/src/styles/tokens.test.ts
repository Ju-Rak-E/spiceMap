import { describe, it, expect } from 'vitest'
import { MAP_THEME, type MapTheme } from './tokens'

const HEX_OR_TRANSPARENT = /^(#[0-9A-Fa-f]{3,8}|transparent)$/

const REQUIRED_KEYS: (keyof typeof MAP_THEME.light)[] = [
  'boundaryLine',
  'boundaryFill',
  'highlightLine',
  'background',
  'toggleBg',
  'toggleText',
  'toggleBorder',
]

const THEMES: MapTheme[] = ['light', 'dark']

describe('MAP_THEME', () => {
  describe.each(THEMES)('%s 테마', (theme) => {
    it('필수 색상 키가 모두 존재해야 한다', () => {
      for (const key of REQUIRED_KEYS) {
        expect(MAP_THEME[theme]).toHaveProperty(key)
      }
    })

    it('모든 색상 값이 유효한 hex 또는 transparent여야 한다', () => {
      for (const [key, value] of Object.entries(MAP_THEME[theme])) {
        expect(value, `${theme}.${key} 값이 유효하지 않음: "${value}"`).toMatch(HEX_OR_TRANSPARENT)
      }
    })
  })

  it('light와 dark의 경계선 색상이 달라야 한다', () => {
    expect(MAP_THEME.dark.boundaryLine).not.toBe(MAP_THEME.light.boundaryLine)
  })

  it('light와 dark의 하이라이트 색상이 달라야 한다', () => {
    expect(MAP_THEME.dark.highlightLine).not.toBe(MAP_THEME.light.highlightLine)
  })

  it('light와 dark의 배경 색상이 달라야 한다', () => {
    expect(MAP_THEME.dark.background).not.toBe(MAP_THEME.light.background)
  })
})
