// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ComponentProps } from 'react'
import FlowControlPanel from './FlowControlPanel'
import type { CommerceNode } from '../types/commerce'
import type { AdvisorCommerce, AdvisorResult } from '../hooks/useStartupAdvisor'

const NODE: CommerceNode = {
  id: 'gc_001',
  name: 'Gangnam Alley',
  coordinates: [127.02, 37.5],
  type: 'test-type' as CommerceNode['type'],
  district: 'Gangnam',
  netFlow: 1200,
  degreeCentrality: 0.8,
  griScore: 82,
  closeRate: 11,
}

const RESULT: AdvisorResult = {
  industry_nm: 'Cafe',
  quarter: '2025Q4',
  summary: 'Cafe recommendation summary',
  caution: '',
  model_used: 'test',
  commerces: [
    {
      comm_cd: 'gc_001',
      comm_nm: 'Gangnam Alley',
      gu_nm: 'Gangnam',
      tier: 'recommended' as AdvisorCommerce['tier'],
      advisor_score: 83.2,
      gri_score: 35,
      flow_volume: 12000,
      closure_rate: 4.2,
      llm_reason: 'High flow. Strong consumption base.',
    },
  ],
}

function renderPanel(overrides: Partial<ComponentProps<typeof FlowControlPanel>> = {}) {
  const props: ComponentProps<typeof FlowControlPanel> = {
    purpose: null,
    onPurposeChange: vi.fn(),
    hour: 14,
    onHourChange: vi.fn(),
    flowStrength: 3,
    onStrengthChange: vi.fn(),
    selectedQuarter: '2025Q4',
    quarters: ['2025Q1', '2025Q4'],
    onQuarterChange: vi.fn(),
    topN: 15,
    scopeLabel: 'Seoul startup analysis',
    usingMockData: false,
    nodes: [NODE],
    selectedNode: null,
    stats: { totalVolume: 12000, activeCount: 3, topInflow: 'Gangnam', topOutflow: 'Gwanak' },
    purposeTotals: ({
      'ì¶œê·¼': 100,
      '?¼í•‘': 200,
      '?¬ê?': 300,
      'ê·€ê°€': 400,
    } as unknown as ComponentProps<typeof FlowControlPanel>['purposeTotals']),
    isPlaying: false,
    speed: 1,
    showFlows: false,
    showBarriers: false,
    onPlay: vi.fn(),
    onPause: vi.fn(),
    onToggleSpeed: vi.fn(),
    onToggleFlows: vi.fn(),
    onToggleBarriers: vi.fn(),
    selectedDistricts: new Set(['Gangnam']),
    onToggleDistrict: vi.fn(),
    onSelectAllDistricts: vi.fn(),
    onClearDistricts: vi.fn(),
    onSetDistricts: vi.fn(),
    onSelectNode: vi.fn(),
    compareQuarter: '2025Q1',
    kpiDelta: null,
    advisorIndustries: ['Cafe', 'Food'],
    advisorLoading: false,
    advisorResult: null,
    advisorError: null,
    onAdvisorAnalyze: vi.fn(),
    onAdvisorReset: vi.fn(),
    onSelectAdvisorCommerce: vi.fn(),
    ...overrides,
  }
  return { ...render(<FlowControlPanel {...props} />), props }
}

afterEach(() => cleanup())

describe('FlowControlPanel founder flow', () => {
  it('starts with the industry selector and empty result section', () => {
    renderPanel()
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('Cafe')
    expect(screen.getAllByRole('button').length).toBeGreaterThan(1)
  })

  it('calls analyze with selected industry and selected districts', async () => {
    const onAdvisorAnalyze = vi.fn()
    renderPanel({ onAdvisorAnalyze })
    await userEvent.click(screen.getAllByRole('button')[0])
    expect(onAdvisorAnalyze).toHaveBeenCalledWith('Cafe', ['Gangnam'])
  })

  it('clears stale advisor result when industry changes', async () => {
    const onAdvisorReset = vi.fn()
    renderPanel({ advisorResult: RESULT, onAdvisorReset })
    await userEvent.selectOptions(screen.getByRole('combobox'), 'Food')
    expect(onAdvisorReset).toHaveBeenCalled()
  })

  it('closes the district detail panel when analysis starts', async () => {
    renderPanel()
    const districtToggle = screen
      .getAllByRole('button')
      .find((button) => button.getAttribute('aria-expanded') === 'false') as HTMLButtonElement

    await userEvent.click(districtToggle)
    expect(districtToggle.getAttribute('aria-expanded')).toBe('true')

    await userEvent.click(screen.getAllByRole('button')[0])
    expect(districtToggle.getAttribute('aria-expanded')).toBe('false')
  })

  it('renders recommendation cards after advisor result', () => {
    renderPanel({ advisorResult: RESULT })
    expect(screen.getByText(/Gangnam Alley/)).toBeTruthy()
  })

  it('shows mobile step tabs when stacked', () => {
    renderPanel({ stacked: true, advisorResult: RESULT })
    expect(screen.getByRole('navigation')).toBeTruthy()
  })

  it('opens the validation report from the header action', async () => {
    const onOpenValidationReport = vi.fn()
    renderPanel({ onOpenValidationReport })
    await userEvent.click(screen.getByTestId('open-validation-report'))
    expect(onOpenValidationReport).toHaveBeenCalled()
  })

  it('downloads CSV from the header action', async () => {
    const onDownloadCsv = vi.fn()
    renderPanel({ onDownloadCsv })
    await userEvent.click(screen.getByTestId('download-csv'))
    expect(onDownloadCsv).toHaveBeenCalled()
  })

  it('does not show header status chips', () => {
    renderPanel({ onOpenValidationReport: vi.fn(), onDownloadCsv: vi.fn() })
    expect(screen.queryByText('Seoul startup analysis')).toBeNull()
    expect(screen.queryByText('API 연결')).toBeNull()
    expect(screen.queryByText(/업종:/)).toBeNull()
    expect(screen.getByText('검증 리포트')).toBeTruthy()
    expect(screen.getByText('CSV 다운로드')).toBeTruthy()
  })
})
