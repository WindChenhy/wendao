/** 数量单位档位（自大而小）：[基数, 单位, 小数位]；原先无 1e16 档，1e21 会显示成「1000000000.00兆」 */
const NUM_UNITS: [number, string, number][] = [
  [1e16, '京', 2],
  [1e12, '兆', 2],
  [1e8, '亿', 2],
  [1e4, '万', 1],
]

export function formatNum(n: number): string {
  // NaN / 非数值不应伪装成「数值极大」：旧实现一律返回 '∞'，会把 undefined 字段的缺陷藏起来
  if (typeof n !== 'number' || Number.isNaN(n)) return '-'
  if (n === Infinity) return '∞'
  if (n === -Infinity) return '-∞'
  const abs = Math.abs(n)
  for (const [base, unit, digits] of NUM_UNITS) {
    if (abs >= base) return `${(n / base).toFixed(digits)}${unit}`
  }
  // Math.trunc：Math.floor 对负数不对称（-0.5 → -1 而 0.5 → 0）
  return String(Math.trunc(n))
}

export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}
