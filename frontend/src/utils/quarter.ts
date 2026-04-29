export function formatQuarter(quarter: string): string {
  const match = quarter.match(/^(\d{4})Q([1-4])$/)
  if (!match) return quarter
  return `${match[1]}년 ${match[2]}분기`
}
