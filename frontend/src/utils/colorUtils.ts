export type RgbTuple = [number, number, number]
export type RgbaTuple = [number, number, number, number]

export function hexToRgb(hex: string): RgbTuple {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function hexToRgba(hex: string, alpha: number): RgbaTuple {
  const [r, g, b] = hexToRgb(hex)
  const a = Math.max(0, Math.min(255, Math.round(alpha)))
  return [r, g, b, a]
}
