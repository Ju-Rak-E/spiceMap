/**
 * MiniGauge — 분포 percentile을 4px 막대로 시각화.
 *
 * docs/hero_shot_scenario.md §1-2: 신림 Hero 패널의 폐업률·GRI 카드에서
 * "상위 X%" 라벨과 함께 위험도 컬러로 채워진 게이지를 노출한다.
 */
interface MiniGaugeProps {
  /** 1~100 범위. 외부 값은 자동 clamp. */
  percentile: number
  /** 채움 색상 (위험도 매핑은 부모 책임). */
  accent: string
  /** 라벨 텍스트 (예: "강남·관악 1,650상권 중 상위 12%"). */
  label: string
}

export default function MiniGauge({ percentile, accent, label }: MiniGaugeProps) {
  const clamped = Math.max(1, Math.min(100, Math.round(percentile)))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
      <div style={{ fontSize: 10, color: '#B0BEC5', lineHeight: 1.3 }}>
        {label}
      </div>
      <div
        role="presentation"
        style={{
          width: '100%',
          height: 4,
          background: '#1A2530',
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          data-testid="mini-gauge-fill"
          style={{
            width: `${clamped}%`,
            height: '100%',
            background: accent,
            borderRadius: 2,
            transition: 'width 220ms ease-out',
          }}
        />
      </div>
    </div>
  )
}
