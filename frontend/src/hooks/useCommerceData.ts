import { useState, useEffect } from 'react'
import type { CommerceNode, CommerceTypeMapResponse } from '../types/commerce'

export interface UseCommerceDataReturn {
  nodes: CommerceNode[]
  isLoading: boolean
  error: string | null
  usingMockData: boolean
}

const BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

async function fetchCommerceNodes(): Promise<{ nodes: CommerceNode[]; isMock: boolean }> {
  if (BASE_URL) {
    try {
      const res = await fetch(`${BASE_URL}/api/commerce/type-map`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as CommerceTypeMapResponse
      return { nodes: data.nodes, isMock: false }
    } catch {
      // API 실패 시 mock 폴백
    }
  }

  const mockRes = await fetch('/data/mock_commerce.json')
  if (!mockRes.ok) throw new Error('mock 데이터를 불러오지 못했습니다')
  const nodes = (await mockRes.json()) as CommerceNode[]
  return { nodes, isMock: true }
}

export function useCommerceData(): UseCommerceDataReturn {
  const [nodes, setNodes] = useState<CommerceNode[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [usingMockData, setUsingMockData] = useState(false)

  useEffect(() => {
    setIsLoading(true)
    fetchCommerceNodes()
      .then(({ nodes: fetched, isMock }) => {
        setNodes(fetched)
        setUsingMockData(isMock)
        setIsLoading(false)
      })
      .catch(() => {
        setError('상권 데이터를 불러오지 못했습니다')
        setIsLoading(false)
      })
  }, [])

  return { nodes, isLoading, error, usingMockData }
}
