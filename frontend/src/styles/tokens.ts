export const COMMERCE_COLORS = {
  흡수형_과열: { fill: '#E53935', icon: 'alert-circle' },
  흡수형_성장: { fill: '#FB8C00', icon: 'trending-up' },
  방출형_침체: { fill: '#9E9E9E', icon: 'trending-down' },
  고립형_단절: { fill: '#424242', icon: 'slash' },
  안정형:      { fill: '#43A047', icon: 'check-circle' },
} as const

export type CommerceType = keyof typeof COMMERCE_COLORS

export const BADGE_COLORS = {
  즉시개입: '#E53935',  // Priority 80+
  연내지원: '#FB8C00',  // Priority 60~79
  모니터링: '#F9A825',  // Priority 40~59
} as const

export type MapTheme = 'light' | 'dark'

export const MAP_THEME = {
  light: {
    boundaryLine: '#BDBDBD',
    boundaryFill: '#9E9E9E',
    highlightLine: '#1565C0',
    background: '#F5F5F5',
    toggleBg: '#FFFFFF',
    toggleText: '#212121',
    toggleBorder: '#BDBDBD',
  },
  dark: {
    boundaryLine: '#546E7A',
    boundaryFill: '#263238',
    highlightLine: '#42A5F5',
    background: '#1A2332',
    toggleBg: '#263238',
    toggleText: '#ECEFF1',
    toggleBorder: '#455A64',
  },
} as const

// 하위 호환용 (기존 코드에서 MAP_COLORS 사용 시)
export const MAP_COLORS = MAP_THEME.light
