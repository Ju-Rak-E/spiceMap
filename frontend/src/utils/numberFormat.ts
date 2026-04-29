export function formatFixed2(value: number): string {
  return value.toFixed(2)
}

export function formatSignedFixed2(value: number): string {
  return `${value >= 0 ? '+' : ''}${formatFixed2(value)}`
}
