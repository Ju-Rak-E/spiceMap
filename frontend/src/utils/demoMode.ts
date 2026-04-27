export function isDemoMode(): boolean {
  return (import.meta.env.VITE_DEMO_MODE as string | undefined) === 'true'
}
