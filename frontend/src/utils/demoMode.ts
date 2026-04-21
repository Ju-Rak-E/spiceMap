export function isDemoMode(): boolean {
  return !(import.meta.env.VITE_API_BASE_URL as string | undefined)
}
