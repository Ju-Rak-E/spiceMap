import type { CSSProperties } from 'react'
import { formatQuarter } from '../utils/quarter'

interface QuarterTimelineSliderProps {
  quarters: string[]
  selectedQuarter: string
  onQuarterChange: (q: string) => void
}

function getYear(quarter: string): string {
  return quarter.slice(0, 4)
}

const S = {
  bar: {
    position: 'absolute' as const,
    bottom: 0,
    left: 0,
    right: 0,
    height: 56,
    background: 'rgba(26, 35, 50, 0.92)',
    backdropFilter: 'blur(8px)',
    borderTop: '1px solid #263238',
    display: 'flex' as const,
    alignItems: 'center',
    padding: '0 16px',
    gap: 12,
    zIndex: 15,
    boxSizing: 'border-box' as const,
    fontFamily: 'system-ui, sans-serif',
  },
  trackLabel: {
    fontSize: 10,
    color: '#546E7A',
    fontWeight: 700,
    letterSpacing: '0.08em',
    textTransform: 'uppercase' as const,
    whiteSpace: 'nowrap' as const,
  },
  track: {
    flex: 1,
    display: 'flex' as const,
    alignItems: 'center',
    justifyContent: 'space-around' as const,
  },
  markerWrapper: {
    display: 'flex' as const,
    alignItems: 'center',
  },
  yearDivider: {
    width: 1,
    height: 20,
    background: '#37474F',
    marginRight: 4,
    flexShrink: 0,
  },
  currentLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: '#7BD08D',
    whiteSpace: 'nowrap' as const,
    minWidth: 56,
    textAlign: 'right' as const,
  },
  markerBtn: (isSelected: boolean): CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
    padding: '6px 10px',
    border: 'none',
    background: isSelected ? 'rgba(123, 208, 141, 0.10)' : 'transparent',
    borderRadius: 6,
    cursor: 'pointer',
  }),
  markerLabel: (isSelected: boolean): CSSProperties => ({
    fontSize: 11,
    fontWeight: isSelected ? 700 : 500,
    color: isSelected ? '#7BD08D' : '#546E7A',
    letterSpacing: '0.02em',
    lineHeight: '1',
  }),
  markerDot: (isSelected: boolean): CSSProperties => ({
    display: 'block',
    width: isSelected ? 6 : 4,
    height: isSelected ? 6 : 4,
    borderRadius: '50%',
    background: isSelected ? '#7BD08D' : '#37474F',
  }),
}

export default function QuarterTimelineSlider({
  quarters,
  selectedQuarter,
  onQuarterChange,
}: QuarterTimelineSliderProps) {
  return (
    <div style={S.bar}>
      <div style={S.trackLabel}>분석 시점</div>
      <div style={S.track}>
        {quarters.map((quarter, index) => {
          const isSelected = quarter === selectedQuarter
          const yearChanged = index > 0 && getYear(quarters[index - 1]) !== getYear(quarter)

          return (
            <div key={quarter} style={S.markerWrapper}>
              {yearChanged && <div style={S.yearDivider} />}
              <button
                type="button"
                onClick={() => onQuarterChange(quarter)}
                aria-pressed={isSelected}
                aria-label={`${formatQuarter(quarter)} 선택`}
                style={S.markerBtn(isSelected)}
              >
                <span style={S.markerLabel(isSelected)}>{formatQuarter(quarter)}</span>
                <span style={S.markerDot(isSelected)} />
              </button>
            </div>
          )
        })}
      </div>
      <div style={S.currentLabel}>{formatQuarter(selectedQuarter)}</div>
    </div>
  )
}
