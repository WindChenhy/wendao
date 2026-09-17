export function formatNum(n: number): string {
  if (!Number.isFinite(n)) return '∞'
  if (Math.abs(n) >= 1e12) return `${(n / 1e12).toFixed(2)}兆`
  if (Math.abs(n) >= 1e8) return `${(n / 1e8).toFixed(2)}亿`
  if (Math.abs(n) >= 1e4) return `${(n / 1e4).toFixed(1)}万`
  return String(Math.floor(n))
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}
