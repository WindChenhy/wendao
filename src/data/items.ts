import type { ItemDef, RealmId } from '../types'
import { REALMS, REALM_ORDER, nextRealm } from './realms'
import { HERB_ITEMS, SEEDS } from './abode'
import {
  GONGFA_LIST,
  canLearnGongfa,
  gongfaByScrollId,
  gongfaGradeOk,
  gongfaScrollId,
  isMarketGongfa,
} from './gongfa'
import { TUNING } from '../game/tuning'
import itemsDb from './db/items.json'
import { priceRealmMul, scaledPrice } from './priceCurve'

/**
 * 丹药/材料/法宝等静态定义：src/data/db/items.json。
 * 售价按 v1.7 价格曲线（品阶档位）缩放 —— 数据表里写的仍是「练气基准价」，
 * 后期档位由 priceCurve.ts 统一抬升，改曲线不必逐条改数据。
 */
const dbItems = (itemsDb.items as ItemDef[]).map((x) => ({
  ...x,
  price: scaledPrice(x.price, x),
}))

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
        // 秘籍按功法起步境界分档抬价（与物品同曲线，见 priceCurve.ts）
        price: Math.max(1, Math.round(g.price * priceRealmMul(g.minRealm))),
      } satisfies ItemDef,
    ]),
  ),
}

/** 背包/坊市分类 */
export type ItemCategory = 'herb' | 'material' | 'gongfa' | 'treasure' | 'pill' | 'misc'

export function itemCategory(id: string): ItemCategory {
  if (gongfaByScrollId(id)) return 'gongfa'
  if (id.startsWith('treasure_')) return 'treasure'
  if (id.startsWith('pill_')) return 'pill'
  // R-18：突破灵材（mat_*）单列「灵材」，不再混入灵药页——「筑基丹」名为丹实是冲关灵材
  if (id.startsWith('mat_')) return 'material'
  if (isHerbLike(id)) return 'herb'
  // 其余（如藏经残页 sect_fragment）归「其他」；此前误归 herb，导致 misc 分支不可达
  return 'misc'
}

/** 分类显示名 */
export const CATEGORY_LABELS: Record<ItemCategory | 'all', string> = {
  all: '全部',
  herb: '灵药',
  material: '灵材',
  gongfa: '功法',
  treasure: '法宝/装备',
  pill: '丹药',
  misc: '其他',
}

/** 法宝属性加成（store 内 treasureBonus 以此为数据源，勿两处改数） */
export const TREASURE_BONUS: Record<
  string,
  {
    atk?: number
    def?: number
    hp?: number
    breakthrough?: number
    cultivate?: number
    /** 闪避概率（0-1 加算；消费端封顶 0.25） */
    dodge?: number
  }
> = itemsDb.treasureBonus

/** 丹纹效果倍率：基础 × (1 + danMarks * 0.15)，5 纹 = 1.75×（口径取 TUNING.danMarkPerStack） */
export function danMarkMul(danMarks: number | undefined): number {
  return 1 + Math.max(0, Math.min(5, danMarks ?? 0)) * TUNING.danMarkPerStack
}

/** 境界序号 */
function ri(realm: RealmId): number {
  return REALM_ORDER.indexOf(realm)
}

/** 起步境界是否满足 */
export function itemMinRealmOk(item: ItemDef, realm: RealmId): boolean {
  if (!item.minRealm) return true
  return ri(realm) >= ri(item.minRealm)
}

/** 是否超出适用上限（超出则药效大幅衰减，不禁止使用） */
export function itemOverScope(item: ItemDef, realm: RealmId): boolean {
  if (!item.maxRealm) return false
  return ri(realm) > ri(item.maxRealm)
}

/** 丹药/灵物品阶文案 */
export function itemTierText(item: ItemDef): string {
  const parts: string[] = []
  if (item.pillGrade) {
    parts.push(`${item.pillGrade}品丹`)
    const d = item.danMarks ?? 0
    parts.push(d > 0 ? `${d}纹` : '无纹')
  }
  if (item.herbTier) {
    // R-18：mat_* 已独立为灵材分类，品阶文案随之改称「灵材」
    parts.push(item.id.startsWith('mat_') ? `${item.herbTier}阶灵材` : `${item.herbTier}阶灵物`)
  }
  if (item.treasureTier) parts.push(`${item.treasureTier}阶法宝`)
  return parts.join(' · ')
}

/** 境界适用范围文案 */
export function itemScopeText(item: ItemDef): string {
  if (!item.minRealm && !item.maxRealm) return ''
  const lo = item.minRealm ? (REALMS[item.minRealm]?.name ?? item.minRealm) : '不限'
  const hi = item.maxRealm ? (REALMS[item.maxRealm]?.name ?? item.maxRealm) : '不设上限'
  return `适用 ${lo} → ${hi}`
}

/** 含丹纹的实际效果数值 */
export function itemEffectWithMarks(item: ItemDef): NonNullable<ItemDef['effect']> {
  const e = item.effect ?? {}
  const mul = danMarkMul(item.danMarks)
  const out: NonNullable<ItemDef['effect']> = { ...e }
  if (e.hp) out.hp = Math.floor(e.hp * mul)
  if (e.exp) out.exp = Math.floor(e.exp * mul)
  if (e.energy) out.energy = Math.floor(e.energy * mul)
  if (e.stone) out.stone = Math.floor(e.stone * mul)
  // 突破率丹纹加成另用一套系数（TUNING.danMarkBreakthroughPerStack），同样封顶 5 纹
  if (e.breakthroughRate) {
    const marks = Math.max(0, Math.min(5, item.danMarks ?? 0))
    out.breakthroughRate = Math.floor(
      e.breakthroughRate * (1 + marks * TUNING.danMarkBreakthroughPerStack),
    )
  }
  return out
}

/** 突破辅助丹药（按成功率从高到低）；冲击壁垒时自动选用背包中最佳一枚 */
const BREAKTHROUGH_PILLS: { id: string; rate: number }[] = itemsDb.breakthroughPills

/** 灵药/妖材归 herb；R-18 后 mat_* 突破灵材不再混入（见 itemCategory） */
function isHerbLike(id: string): boolean {
  return id.startsWith('herb_') || ['snake_gall', 'fox_core', 'tiger_bone', 'demon_shard'].includes(id)
}

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

/**
 * 背包中可用的最佳突破丹药（无则 null）。
 * 传入 realm 时只考虑「起步境界已满足」的丹药 —— 药力过猛者经文未足，不可强服。
 * 成功率一律走 itemEffectWithMarks，使丹纹加成与其余药效同源（原先直接取基础数值，丹纹被吞）。
 */
export function bestBreakthroughPill(
  inventory: Record<string, number>,
  realm?: RealmId,
): { id: string; rate: number; name: string } | null {
  for (const p of BREAKTHROUGH_PILLS) {
    const item = ITEMS[p.id]
    if (!item) continue
    if (realm && !itemMinRealmOk(item, realm)) continue
    if ((inventory[p.id] ?? 0) > 0) {
      const rate = itemEffectWithMarks(item).breakthroughRate ?? p.rate
      return { id: p.id, rate, name: item.name }
    }
  }
  return null
}

/** 展示名解析：丹药/材料/法宝在 ITEMS，灵植种子在 SEEDS，功法秘籍由 gongfa 表派生 */
export function displayItemName(id: string): string {
  const item = ITEMS[id]
  if (item) return item.name
  const seed = SEEDS[id]
  if (seed) return seed.name
  const g = gongfaByScrollId(id)
  if (g) return `${g.name}秘籍`
  return id
}

/** 大境界突破材料表。语义：**冲入目标大境界**所需之物
 * （`foundation: mat_foundation` = 练气圆满冲筑基需「筑基丹」）。
 * 故查询时必须先取 nextRealm，否则会整体错开一位（历史上练气→筑基零消耗）。
 */
export const BREAKTHROUGH_MATERIALS: Partial<Record<RealmId, string>> =
  itemsDb.breakthroughMaterials as Partial<Record<RealmId, string>>

/** 大境界满层时所需材料（按目标境界取，飞升无材料） */
export function requiredMaterial(realm: RealmId, layer: number): string | null {
  const maxLayer = REALMS[realm]?.layers ?? 9
  if (layer < maxLayer) return null
  const target = nextRealm(realm)
  if (!target) return null
  return BREAKTHROUGH_MATERIALS[target] ?? null
}

export function materialName(id: string): string {
  return ITEMS[id]?.name ?? id
}

/**
 * 修为丹实际收益（唯一口径）。
 *
 * v1.5（R-03）之前存在两套口径：`pill_qi*` 走公式 `60×1.55^境界×品阶系数`，
 * 其余修为丹走 `items.json` 的固定 `effect.exp`，且 `pill_qi` 数据里写的 exp 从未生效。
 * 现在统一以数据为准：收益 = itemEffectWithMarks(exp) × 超范围衰减，
 * 丹纹与品阶加成由 `itemEffectWithMarks` 统一施加，境界外溢由 maxRealm + 超范围衰减约束。
 */
export function consumableExpGain(item: ItemDef, realm: RealmId): number {
  const eff = itemEffectWithMarks(item)
  if (!eff.exp || eff.exp <= 0) return 0
  return Math.floor(eff.exp * (itemOverScope(item, realm) ? TUNING.overScopeEfficiency : 1))
}

/** 坊市货架（按分类）；功法只上架坊市秘籍，宗门秘法仅藏经阁产出 */
export const MARKET_STOCK: Record<'herb' | 'material' | 'gongfa' | 'treasure' | 'pill', string[]> = {
  pill: [...itemsDb.marketStock.pill],
  herb: [...itemsDb.marketStock.herb],
  material: [...itemsDb.marketStock.material],
  gongfa: GONGFA_LIST.filter(isMarketGongfa).map((g) => gongfaScrollId(g.id)),
  treasure: [...itemsDb.marketStock.treasure],
}

/**
 * 使用该货物所需的最低境界（= 物品自身 minRealm；无限制为 null）。
 *
 * 口径（用户拍板）：**境界只约束「使用」，不约束「买卖」**。
 * 坊市不因境界拦买卖：想买随时买，买回来用不了是自己的事（丹药照服会药效大减/被门槛拦在服用环节，
 * 功法照买但要到境界才能参悟，突破灵材照买但要到境界才有用）。售卖同样不限境界。
 */
export function itemUsageRealm(id: string): RealmId | null {
  return ITEMS[id]?.minRealm ?? null
}

/** 当前境界是否可「使用」该货物（与实际使用环节同源；买卖不看它） */
export function itemUsableAt(id: string, realm: RealmId): boolean {
  const need = itemUsageRealm(id)
  return !need || ri(realm) >= ri(need)
}

/** 未达使用境界时的说明文案（提示用，不拦买卖） */
export function itemUsageHint(id: string): string {
  const need = itemUsageRealm(id)
  if (!need) return ''
  return `需${REALMS[need]?.name ?? need}修为方可使用`
}

/** 货架分区类型（含「全部」） */
export type MarketTab = 'all' | 'herb' | 'material' | 'gongfa' | 'treasure' | 'pill'

/**
 * 某分区的全部上架货物。
 * 买卖不受境界限制，故货架与玩家境界无关 —— 所有在售货物一律列出（不再隐藏、不再灰锁）。
 */
export function marketStock(tab: MarketTab): string[] {
  const cats = ['herb', 'material', 'gongfa', 'treasure', 'pill'] as const
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of cats.flatMap((c) => MARKET_STOCK[c])) {
    if (seen.has(id)) continue
    seen.add(id)
    if (tab !== 'all' && itemCategory(id) !== tab) continue
    out.push(id)
  }
  return out
}

/** 货架条目相对**当前境界**的档位：适配 / 超前（境界未到）/ 过时（已超适用范围） */
export type MarketTier = 'fit' | 'above' | 'below'

export interface MarketEntry {
  id: string
  tier: MarketTier
}

/** 排序权重：当前境界用得上的在前，其次是可望可即的高阶货，已被境界淘汰的垫底 */
const TIER_WEIGHT: Record<MarketTier, number> = { fit: 0, above: 1, below: 2 }

/**
 * 该货物相对当前境界的档位。**只用于排序与展示，不参与拦截**（买卖仍不限境界）。
 *
 * 功法秘籍走功法口径：起步境界未到 = 超前；品阶已被当前境界淘汰 = 过时。
 * 其余货物走物品口径：minRealm 未到 = 超前；超过 maxRealm = 过时。
 */
export function marketTierOf(id: string, realm: RealmId | null | undefined): MarketTier {
  if (!realm) return 'fit'
  const g = gongfaByScrollId(id)
  if (g) {
    if (!canLearnGongfa(g, realm)) return 'above'
    return gongfaGradeOk(g, realm) ? 'fit' : 'below'
  }
  const item = ITEMS[id]
  if (!item) return 'fit'
  if (item.minRealm && ri(realm) < ri(item.minRealm)) return 'above'
  if (itemOverScope(item, realm)) return 'below'
  return 'fit'
}

/**
 * 某分区的货架（**按玩家当前境界层级排序**）。
 *
 * 与 `marketStock(tab)` 的关系：集合完全相同，只是顺序不同 ——
 * 「买卖不限境界」的口径不动，一条货物也不下架，仅把当前境界正用得上的排到前面。
 *
 * 由此得到两条硬保证（移动端「突破后货架空白」的根源防线）：
 * 1. 大境界一变，排序键随之变化，货架在同一帧内按新境界重排，**无需退出坊市重进**；
 * 2. 排序是集合内的置换，**不会增删任何条目**，因此不存在「清空 / 长期为空」的中间态。
 */
export function marketStockFor(
  realm: RealmId | null | undefined,
  tab: MarketTab,
): MarketEntry[] {
  return marketStock(tab)
    .map((id, index) => ({ id, tier: marketTierOf(id, realm), index }))
    // 显式带上原始下标做次级键，不依赖引擎的排序稳定性
    .sort((a, b) => TIER_WEIGHT[a.tier] - TIER_WEIGHT[b.tier] || a.index - b.index)
    .map(({ id, tier }) => ({ id, tier }))
}
