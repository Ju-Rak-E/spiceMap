export function buildCommerceBoundaryApiUrl(apiBase: string, quarter: string, district: string): string {
  const base = apiBase.replace(/\/$/, '')
  const params = new URLSearchParams({ quarter, gu: district })
  return `${base}/api/commerce/type-map?${params.toString()}`
}
