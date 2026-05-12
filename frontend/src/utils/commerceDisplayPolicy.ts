export type CommerceDisplayZoomStage = 'city' | 'district' | 'dong' | 'candidate'
export type CommerceClusterDisplayLevel = 'none' | 'district' | 'dong'
export type CommerceNodeDisplayScope = 'all' | 'viewport'

const FOCUSED_DISTRICT_MAX = 3
const SEOUL_WIDE_RATIO = 0.8

export interface CommerceDisplayPolicyInput {
  zoomStage: CommerceDisplayZoomStage
  selectedDistrictCount: number
  totalDistrictCount: number
  hasSelectedNode?: boolean
}

export interface CommerceDisplayPolicy {
  isSeoulWideScope: boolean
  isFocusedScope: boolean
  clusterLevel: CommerceClusterDisplayLevel
  showCommerceNodes: boolean
  nodeScope: CommerceNodeDisplayScope
  statusLabel: string | null
}

export function resolveCommerceDisplayPolicy({
  zoomStage,
  selectedDistrictCount,
  totalDistrictCount,
  hasSelectedNode = false,
}: CommerceDisplayPolicyInput): CommerceDisplayPolicy {
  const safeTotal = Math.max(1, totalDistrictCount)
  const isSeoulWideScope = selectedDistrictCount >= Math.ceil(safeTotal * SEOUL_WIDE_RATIO)
  const isFocusedScope = selectedDistrictCount > 0 && selectedDistrictCount <= FOCUSED_DISTRICT_MAX
  const canShowCommerceNodes = zoomStage === 'candidate'
  const nodeScope: CommerceNodeDisplayScope = zoomStage === 'candidate' ? 'viewport' : 'all'

  let clusterLevel: CommerceClusterDisplayLevel = 'none'
  if (zoomStage === 'district') {
    clusterLevel = 'district'
  } else if (zoomStage === 'dong') {
    clusterLevel = isFocusedScope ? 'dong' : 'district'
  }

  let statusLabel: string | null = null
  if (hasSelectedNode && zoomStage === 'candidate') {
    statusLabel = '선택 상권 중심 표시'
  } else if (zoomStage === 'candidate') {
    statusLabel = '현재 화면 상권만 표시 중'
  } else if (isSeoulWideScope && zoomStage === 'dong') {
    statusLabel = '서울 전체는 구 단위 요약 표시 중'
  } else if (!isFocusedScope && zoomStage === 'dong') {
    statusLabel = '넓은 범위는 구 단위 요약 표시 중'
  } else if (isFocusedScope && zoomStage === 'dong') {
    statusLabel = '자치구 상세 표시 중'
  }

  return {
    isSeoulWideScope,
    isFocusedScope,
    clusterLevel,
    showCommerceNodes: canShowCommerceNodes,
    nodeScope,
    statusLabel,
  }
}
