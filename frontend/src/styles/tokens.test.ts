import { describe, it, expect } from 'vitest'
import { MAP_THEME, COMMERCE_COLORS, type MapTheme } from './tokens'

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

describe('COMMERCE_COLORS', () => {
  const TYPES = ['흡수형_과열', '흡수형_성장', '방출형_침체', '고립형_단절', '안정형'] as const
  const HEX = /^#[0-9A-Fa-f]{6}$/

  it('5개 상권 유형이 모두 정의되어 있어야 한다', () => {
    expect(Object.keys(COMMERCE_COLORS)).toHaveLength(5)
    for (const t of TYPES) {
      expect(COMMERCE_COLORS).toHaveProperty(t)
    }
  })

  it('각 유형에 fill, symbol, label이 존재해야 한다', () => {
    for (const t of TYPES) {
      const token = COMMERCE_COLORS[t]
      expect(token).toHaveProperty('fill')
      expect(token).toHaveProperty('symbol')
      expect(token).toHaveProperty('label')
    }
  })

  it('fill 색상이 유효한 hex 값이어야 한다', () => {
    for (const t of TYPES) {
      expect(COMMERCE_COLORS[t].fill, `${t} fill 색상 유효하지 않음`).toMatch(HEX)
    }
  })

  it('symbol이 비어있지 않아야 한다 (색각 이상 대응 FR-11)', () => {
    for (const t of TYPES) {
      expect(COMMERCE_COLORS[t].symbol.length).toBeGreaterThan(0)
    }
  })

  it('label이 비어있지 않아야 한다', () => {
    for (const t of TYPES) {
      expect(COMMERCE_COLORS[t].label.length).toBeGreaterThan(0)
    }
  })

  it('유형별 fill 색상이 모두 달라야 한다', () => {
    const fills = TYPES.map(t => COMMERCE_COLORS[t].fill)
    const unique = new Set(fills)
    expect(unique.size).toBe(TYPES.length)
  })
})
