// @vitest-environment jsdom
import { afterEach, describe, it, expect } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import InsightStrip, { countCriticalCommerces } from './InsightStrip'
import type { CommerceNode } from '../types/commerce'

function makeNode(overrides: Partial<CommerceNode>): CommerceNode {
  return {
    id: 't1',
    name: '테스트',
    coordinates: [127, 37.5],
    type: '안정형',
    griScore: 50,
    netFlow: 0,
    degreeCentrality: 0.5,
    closeRate: 1.0,
    district: '강남구',
    ...overrides,
  } as CommerceNode
}

describe('InsightStrip', () => {
  afterEach(() => cleanup())

  it('renders three cards with provided KPIs', () => {
    render(
      <InsightStrip
        h1R={0.106}
        h1P={2.83e-5}
        policyCardCount={414}
        criticalCommerceCount={37}
        quarter="2025Q4"
      />
    )
    expect(screen.getByTestId('insight-strip')).toBeTruthy()
    expect(screen.getByText('0.106')).toBeTruthy()
    expect(screen.getByText('414')).toBeTruthy()
    expect(screen.getByText('37')).toBeTruthy()
    expect(screen.getByText('2025Q4 GRI ≥ 80')).toBeTruthy()
  })

  it('formats p-value in scientific notation when very small', () => {
    render(
      <InsightStrip h1R={0.5} h1P={2.83e-5} policyCardCount={1} criticalCommerceCount={0} />
    )
    // 매우 작은 p값 → 과학표기
    expect(screen.getByText(/p=2\.8e-5/)).toBeTruthy()
  })

  it('shows em-dash when r missing', () => {
    render(
      <InsightStrip h1R={null} policyCardCount={0} criticalCommerceCount={0} />
    )
    expect(screen.getByText('—')).toBeTruthy()
  })

  it('thousand separator on policy/critical counts', () => {
    render(
      <InsightStrip h1R={0} policyCardCount={1234} criticalCommerceCount={5678} />
    )
    expect(screen.getByText('1,234')).toBeTruthy()
    expect(screen.getByText('5,678')).toBeTruthy()
  })
})

describe('countCriticalCommerces', () => {
  it('counts only nodes with griScore ≥ 80', () => {
    const nodes = [
      makeNode({ id: 'a', griScore: 90 }),
      makeNode({ id: 'b', griScore: 80 }),
      makeNode({ id: 'c', griScore: 79.99 }),
      makeNode({ id: 'd', griScore: 0 }),
    ]
    expect(countCriticalCommerces(nodes)).toBe(2)
  })

  it('returns 0 for empty array', () => {
    expect(countCriticalCommerces([])).toBe(0)
  })

  it('treats null/undefined gri as 0', () => {
    const nodes = [makeNode({ griScore: undefined as any })]
    expect(countCriticalCommerces(nodes)).toBe(0)
  })
})
