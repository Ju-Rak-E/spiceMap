import { describe, expect, it } from 'vitest'
import { buildCommerceBoundaryApiUrl } from './CommerceBoundaryLayer'

describe('buildCommerceBoundaryApiUrl', () => {
  it('uses the Vite proxy path when API base is empty', () => {
    const url = buildCommerceBoundaryApiUrl('', '2025Q4', '관악구')
    const parsed = new URL(url, 'http://localhost')

    expect(parsed.pathname).toBe('/api/commerce/type-map')
    expect(parsed.searchParams.get('quarter')).toBe('2025Q4')
    expect(parsed.searchParams.get('gu')).toBe('관악구')
  })

  it('avoids double slashes when API base has a trailing slash', () => {
    const url = buildCommerceBoundaryApiUrl('http://127.0.0.1:8000/', '2025Q4', '강남구')
    const parsed = new URL(url)

    expect(parsed.origin).toBe('http://127.0.0.1:8000')
    expect(parsed.pathname).toBe('/api/commerce/type-map')
    expect(parsed.searchParams.get('gu')).toBe('강남구')
  })
})
