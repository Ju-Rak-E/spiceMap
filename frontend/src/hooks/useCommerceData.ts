import { useState, useEffect } from 'react'
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

async function fetchMockCommerceNodes(): Promise<{ nodes: CommerceNode[]; isMock: boolean }> {
  const mockRes = await fetch('/data/mock_commerce.json')
  if (!mockRes.ok) throw new Error('mock 데이터를 불러오지 못했습니다')
  const nodes = (await mockRes.json()) as CommerceNode[]
  return { nodes, isMock: true }
}

async function fetchCommerceNodes(quarter: string): Promise<{ nodes: CommerceNode[]; isMock: boolean }> {
  if (isDemoMode()) {
    return fetchMockCommerceNodes()
  }

  const params = new URLSearchParams({ quarter })
  const res = await fetch(`${BASE_URL}/api/commerce/type-map?${params.toString()}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const data = (await res.json()) as CommerceTypeMapResponse
  return { nodes: featuresToNodes(data.features), isMock: false }
}

export function useCommerceData(quarter = '2025Q4'): UseCommerceDataReturn {
  const [nodes, setNodes] = useState<CommerceNode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [usingMockData, setUsingMockData] = useState(false)

  useEffect(() => {
    queueMicrotask(() => {
      setIsLoading(true)
      setError(null)
    })
    fetchCommerceNodes(quarter)
      .then(({ nodes: fetched, isMock }) => {
        setNodes(fetched)
        setUsingMockData(isMock)
        setIsLoading(false)
      })
      .catch(() => {
        setNodes([])
        setUsingMockData(false)
        setError('상권 데이터를 불러오지 못했습니다')
        setIsLoading(false)
      })
  }, [quarter])

  return { nodes, isLoading, error, usingMockData }
}
