import { ITEMS, itemMinRealmOk, itemOverScope } from './items'
import { canLearnGongfaFull, gongfaByScrollId } from './gongfa'
import { ASCENSION_REALM, REALMS, REALM_ORDER } from './realms'
import type { RealmId } from '../types'

/**
 * 背包/坊市共用的搜索与境界筛选（唯一口径，两页勿各写一份）。
 * - 搜索：按名称模糊匹配（秘籍同时匹配功法名与物品名）
 * - 境界：按「使用/参悟所需的最低境界」筛选
 */

export type RealmFilterMode = 'all' | 'fit' | 'none' | RealmId

/** 该条目使用或参悟所需的最低境界（无门槛返回 null） */
export function itemRealmNeed(id: string): RealmId | null {
  const g = gongfaByScrollId(id)
  if (g) return g.minRealm
  return ITEMS[id]?.minRealm ?? null
}

/** 参与搜索的文本：物品名 +（秘籍）功法名 */
export function itemSearchText(id: string): string {
  const item = ITEMS[id]
  const g = gongfaByScrollId(id)
  return [item?.name ?? id, g?.name ?? ''].join(' ')
}

export function matchesName(id: string, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return itemSearchText(id).toLowerCase().includes(q)
}

/** 境界筛选：all 不限 / fit 当前境界可用 / none 无境界门槛 / 指定境界＝需求境界正好是它 */
export function matchesRealm(
  id: string,
  mode: RealmFilterMode,
  realm: RealmId | null | undefined,
): boolean {
  if (mode === 'all') return true
  const need = itemRealmNeed(id)
  if (mode === 'none') return need === null
  if (mode === 'fit') {
    if (!realm) return true
    const g = gongfaByScrollId(id)
    if (g) return canLearnGongfaFull(g, realm)
    const item = ITEMS[id]
    if (!item) return false
    return itemMinRealmOk(item, realm) && !itemOverScope(item, realm)
  }
  return need === mode
}

export const REALM_FILTER_OPTIONS: { value: RealmFilterMode; label: string }[] = [
  { value: 'all', label: '境界：不限' },
  { value: 'fit', label: '境界：当前可用' },
  { value: 'none', label: '境界：无门槛' },
  // 飞升是终局哨兵，不是可选修行境界：不进筛选下拉
  ...REALM_ORDER.filter((r) => r !== ASCENSION_REALM && REALMS[r]).map((r) => ({
    value: r as RealmFilterMode,
    label: `境界：${REALMS[r]?.name ?? r}`,
  })),
]
