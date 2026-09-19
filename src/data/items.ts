import type { ItemDef, RealmId } from '../types'
import { REALMS, REALM_ORDER } from './realms'
import { HERB_ITEMS } from './abode'
import { GONGFA_LIST, gongfaByScrollId, gongfaScrollId, isMarketGongfa } from './gongfa'
import itemsDb from './db/items.json'

/** 丹药/材料/法宝等静态定义：src/data/db/items.json */
const dbItems = itemsDb.items as ItemDef[]

function toRecord(list: ItemDef[]): Record<string, ItemDef> {
  return Object.fromEntries(list.map((x) => [x.id, x]))
}

export const ITEMS: Record<string, ItemDef> = {
  ...HERB_ITEMS,
  ...toRecord(dbItems),
  // 功法秘籍由功法表派生（坊市流通部分）；宗门秘法不生成秘籍物品
  ...Object.fromEntries(
    GONGFA_LIST.filter(isMarketGongfa).map((g) => [
      gongfaScrollId(g.id),
      {
        id: gongfaScrollId(g.id),
        name: `${g.name}·秘籍`,
        type: 'quest' as const,
        desc: `${g.grade}功法。${g.desc}`,
        price: g.price,
      } satisfies ItemDef,
    ]),
  ),
}

/** 背包/坊市分类 */
export type ItemCategory = 'herb' | 'gongfa' | 'treasure' | 'pill' | 'misc'

export function itemCategory(id: string): ItemCategory {
  if (gongfaByScrollId(id)) return 'gongfa'
  if (id.startsWith('treasure_')) return 'treasure'
  if (id.startsWith('pill_')) return 'pill'
  return 'herb'
}

/** 分类显示名 */
export const CATEGORY_LABELS: Record<ItemCategory | 'all', string> = {
  all: '全部',
  herb: '灵药',
  gongfa: '功法',
  treasure: '法宝/装备',
  pill: '丹药',
  misc: '其他',
}

/** 法宝属性加成（store 内 treasureBonus 以此为数据源，勿两处改数） */
export const TREASURE_BONUS: Record<
  string,
  { atk?: number; def?: number; hp?: number; breakthrough?: number }
> = itemsDb.treasureBonus

/** 突破辅助丹药（按成功率从高到低）；冲击壁垒时自动选用背包中最佳一枚 */
export const BREAKTHROUGH_PILLS: { id: string; rate: number }[] = itemsDb.breakthroughPills

/** 法宝加成文案，如 "攻击 +25%、突破 +8%" */
export function treasureEffectText(id: string): string {
  const b = TREASURE_BONUS[id]
  if (!b) return ''
  const parts: string[] = []
  if (b.atk) parts.push(`攻击 +${Math.round(b.atk * 100)}%`)
  if (b.def) parts.push(`防御 +${Math.round(b.def * 100)}%`)
  if (b.hp) parts.push(`气血 +${Math.round(b.hp * 100)}%`)
  if (b.breakthrough) parts.push(`突破成功率 +${b.breakthrough}%`)
  return parts.join('、')
}

/** 认主突破法宝加成（同类不叠加） */
export function treasureBreakthroughBonus(treasures: string[]): number {
  let bonus = 0
  const seen = new Set<string>()
  for (const id of treasures) {
    if (seen.has(id)) continue
    const b = TREASURE_BONUS[id]
    if (b?.breakthrough) {
      seen.add(id)
      bonus += b.breakthrough
    }
  }
  return bonus
}

/** 背包中可用的最佳突破丹药（无则 null） */
export function bestBreakthroughPill(
  inventory: Record<string, number>,
): { id: string; rate: number; name: string } | null {
  for (const p of BREAKTHROUGH_PILLS) {
    if ((inventory[p.id] ?? 0) > 0) {
      return { id: p.id, rate: p.rate, name: ITEMS[p.id]?.name ?? p.id }
    }
  }
  return null
}

/** 大境界突破材料表 */
export const BREAKTHROUGH_MATERIALS: Partial<Record<RealmId, string>> =
  itemsDb.breakthroughMaterials as Partial<Record<RealmId, string>>

/** 大境界满层时所需材料 */
export function requiredMaterial(realm: RealmId, layer: number): string | null {
  const maxLayer = REALMS[realm]?.layers ?? 9
  if (layer < maxLayer) return null
  return BREAKTHROUGH_MATERIALS[realm] ?? null
}

export function materialName(id: string): string {
  return ITEMS[id]?.name ?? id
}

/** 聚气丹收益随境界 */
export function pillExp(realm: RealmId): number {
  const ri = Math.max(0, REALM_ORDER.indexOf(realm))
  return Math.floor(60 * Math.pow(1.55, ri))
}

/** 坊市货架（按分类）；功法只上架坊市秘籍，宗门秘法仅藏经阁产出 */
export const MARKET_STOCK: Record<'herb' | 'gongfa' | 'treasure' | 'pill', string[]> = {
  pill: [...itemsDb.marketStock.pill],
  herb: [...itemsDb.marketStock.herb],
  gongfa: GONGFA_LIST.filter(isMarketGongfa).map((g) => gongfaScrollId(g.id)),
  treasure: [...itemsDb.marketStock.treasure],
}
