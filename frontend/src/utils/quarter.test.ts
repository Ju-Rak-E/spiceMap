import { describe, expect, it } from 'vitest'
import { formatQuarter } from './quarter'

describe('formatQuarter', () => {
  it('YYYYQ# 값을 사용자용 분기 라벨로 변환한다', () => {
    expect(formatQuarter('2025Q4')).toBe('2025년 4분기')
  })

  it('알 수 없는 형식은 원문을 유지한다', () => {
    expect(formatQuarter('latest')).toBe('latest')
  })
})
