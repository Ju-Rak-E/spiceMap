import { useEffect, useState } from 'react'
import type { CommerceNode, CommerceTypeMapResponse } from '../types/commerce'
import { featuresToNodes } from '../types/commerce'
import { isDemoMode } from '../utils/demoMode'

export interface UseCommerceDataReturn {
  nodes: CommerceNode[]
  isLoading: boolean
  error: string | null
  usingMockData: boolean
}

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''
const EMPTY_DISTRICTS = new Set<string>()

async function fetchMockCommerceNodes(): Promise<{ nodes: CommerceNode[]; isMock: boolean }> {
  const mockRes = await fetch('/data/mock_commerce.json')
  if (!mockRes.ok) throw new Error('Failed to load mock commerce data')
  const nodes = (await mockRes.json()) as CommerceNode[]
  return { nodes, isMock: true }
}

async function fetchCommerceNodes(quarter: string, gu: string): Promise<CommerceNode[]> {
  const params = new URLSearchParams({ quarter, gu })
  const res = await fetch(`${BASE_URL}/api/commerce/type-map?${params.toString()}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as CommerceTypeMapResponse
  return featuresToNodes(data.features).map((node) => ({
    ...node,
    // The request is already scoped by gu; use it as the canonical district
    // because some DB rows currently return mojibake gu_nm values.
    district: gu,
  }))
}

async function fetchCommerceNodesForDistricts(
  quarter: string,
  districts: string[],
): Promise<{ nodes: CommerceNode[]; isMock: boolean }> {
  if (districts.length === 0) {
    return { nodes: [], isMock: false }
  }

  if (isDemoMode()) {
    return fetchMockCommerceNodes()
  }

  const groupedNodes = await Promise.all(
    districts.map((district) => fetchCommerceNodes(quarter, district)),
  )
  return { nodes: groupedNodes.flat(), isMock: false }
}

export function useCommerceData(
  quarter = '2025Q4',
  districts: ReadonlySet<string> = EMPTY_DISTRICTS,
): UseCommerceDataReturn {
  const [nodes, setNodes] = useState<CommerceNode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [usingMockData, setUsingMockData] = useState(false)
  const districtKey = [...districts].sort().join('|')

  useEffect(() => {
    let cancelled = false
    const districtList = districtKey ? districtKey.split('|') : []

    queueMicrotask(() => {
      if (cancelled) return
      setIsLoading(true)
      setError(null)
    })

    fetchCommerceNodesForDistricts(quarter, districtList)
      .then(({ nodes: fetched, isMock }) => {
        if (cancelled) return
        setNodes(fetched)
        setUsingMockData(isMock)
        setIsLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setNodes([])
        setUsingMockData(false)
        setError('Failed to load commerce data')
        setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [districtKey, quarter])

  return { nodes, isLoading, error, usingMockData }
}
