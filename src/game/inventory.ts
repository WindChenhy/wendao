/**
 * 背包增删原语（纯函数，约定传入的 inv 已是副本，原地修改后返回）。
 * 统一「无则建键、减到 0 删键」的规则，替代散落各处的手写行。
 */

/** 数量 +n（默认 1）；键不存在视为 0 起算 */
export function addItem(inv: Record<string, number>, id: string, n = 1): Record<string, number> {
  inv[id] = (inv[id] ?? 0) + n
  return inv
}

/** 数量 -n（默认 1）；扣减后 <= 0 则移除该键 */
export function removeItem(inv: Record<string, number>, id: string, n = 1): Record<string, number> {
  const left = (inv[id] ?? 0) - n
  if (left <= 0) delete inv[id]
  else inv[id] = left
  return inv
}
