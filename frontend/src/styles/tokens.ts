export const COMMERCE_COLORS = {
  흡수형_과열: { fill: '#E53935', icon: 'alert-circle', symbol: '▲', label: '흡수형 과열', badgeColor: 'rgba(229,57,53,0.18)', textColor: '#EF9A9A', outline: '#C62828', description: '유입이 강하고 과열 위험이 높은 상권' },
  흡수형_성장: { fill: '#FB8C00', icon: 'trending-up',  symbol: '↗', label: '흡수형 성장', badgeColor: 'rgba(251,140,0,0.18)',  textColor: '#FFCC80', outline: '#E65100', description: '유입과 성장세가 함께 보이는 상권' },
  방출형_침체: { fill: '#9E9E9E', icon: 'trending-down', symbol: '↘', label: '방출형 침체', badgeColor: 'rgba(158,158,158,0.18)', textColor: '#BDBDBD', outline: '#616161', description: '유출이 지속되고 침체 위험이 큰 상권' },
  고립형_단절: { fill: '#424242', icon: 'slash',         symbol: '○', label: '고립형 단절', badgeColor: 'rgba(66,66,66,0.35)',    textColor: '#90A4AE', outline: '#37474F', description: '연결이 약해 흐름이 고립된 상권' },
  안정형:      { fill: '#43A047', icon: 'check-circle',  symbol: '●', label: '안정형',     badgeColor: 'rgba(67,160,71,0.18)',   textColor: '#A5D6A7', outline: '#2E7D32', description: '유입·유출 변동이 비교적 안정적인 상권' },
  미분류:      { fill: '#5C6F80', icon: 'help-circle',   symbol: '?', label: '미분류 (분석 대기)', badgeColor: 'rgba(92,111,128,0.18)', textColor: '#B0BEC5', outline: '#37474F', description: 'Dev-C 분석 결과가 아직 산출되지 않은 상권' },
} as const

export type CommerceType = keyof typeof COMMERCE_COLORS

export const INTERVENTION_BADGES = {
  즉시개입: { label: '즉시개입', color: '#EF9A9A', bg: 'rgba(229,57,53,0.22)' },  // GRI 80+
  연내지원: { label: '연내지원', color: '#FFCC80', bg: 'rgba(251,140,0,0.22)'  },  // GRI 60~79
  모니터링: { label: '모니터링', color: '#FFF176', bg: 'rgba(249,168,37,0.22)' },  // GRI 40~59
} as const

export function getInterventionBadge(griScore: number) {
  if (griScore >= 80) return INTERVENTION_BADGES.즉시개입
  if (griScore >= 60) return INTERVENTION_BADGES.연내지원
  if (griScore >= 40) return INTERVENTION_BADGES.모니터링
  return null
}

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
    panelBg: '#FFFFFF',
    panelSurface: '#F7F9FB',
    panelBorder: '#D5DDE5',
    panelText: '#15202B',
    secondaryText: '#4E5D6C',
    mutedText: '#708090',
  },
  dark: {
    boundaryLine: '#304251',
    boundaryFill: '#17202A',
    highlightLine: '#7DC5FF',
    background: '#0E141B',
    toggleBg: '#1A2530',
    toggleText: '#E7EEF5',
    toggleBorder: '#2C3B47',
    panelBg: '#10161D',
    panelSurface: '#151D26',
    panelBorder: '#24323F',
    panelText: '#E7EEF5',
    secondaryText: '#A6B4C2',
    mutedText: '#6E8093',
  },
} as const

// 하위 호환용 (기존 코드에서 MAP_COLORS 사용 시)
export const MAP_COLORS = MAP_THEME.light
