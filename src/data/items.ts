import type { ItemDef, RealmId } from '../types'
import { REALMS, REALM_ORDER, nextRealm } from './realms'
import { HERB_ITEMS, SEEDS } from './abode'
import { GONGFA_LIST, gongfaByScrollId, gongfaScrollId, isMarketGongfa } from './gongfa'
import { TUNING } from '../game/tuning'
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

/** 丹纹效果倍率：基础 × (1 + danMarks * 0.15)，5 纹 = 1.75× */
export function danMarkMul(danMarks: number | undefined): number {
  return 1 + Math.max(0, Math.min(5, danMarks ?? 0)) * 0.15
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
  if (e.breakthroughRate) out.breakthroughRate = Math.floor(e.breakthroughRate * (1 + (item.danMarks ?? 0) * 0.04))
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
const BREAKTHROUGH_MATERIALS: Partial<Record<RealmId, string>> =
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
 * 坊市境界闸门（R-14）。
 * 除物品自身的 minRealm 外，少数流通物另有开市境界（如渡劫令须大乘后方有市）。
 * 闸门是买入拦截与货架展示的共同依据，勿只在 UI 隐藏。
 */
export const MARKET_REALM_GATES: Record<string, RealmId> = {
  mat_tribulation: 'mahayana',
}

/** 该货物在坊市流通所需的最低境界（物品 minRealm 与特殊闸门取高者；无限制为 null） */
export function marketGateRealm(id: string): RealmId | null {
  const item = ITEMS[id]
  const candidates: RealmId[] = []
  if (item?.minRealm) candidates.push(item.minRealm)
  const gate = MARKET_REALM_GATES[id]
  if (gate) candidates.push(gate)
  if (candidates.length === 0) return null
  return candidates.reduce((a, b) => (ri(b) > ri(a) ? b : a))
}

export type MarketEntryStatus = { ok: true } | { ok: false; minRealm: RealmId }

/** 某境界下该货物可否成交（买入拦截唯一入口） */
export function marketEntryStatus(id: string, realm: RealmId): MarketEntryStatus {
  const need = marketGateRealm(id)
  if (!need || ri(realm) >= ri(need)) return { ok: true }
  return { ok: false, minRealm: need }
}

/** 货架分区类型（含「全部」） */
export type MarketTab = 'all' | 'herb' | 'material' | 'gongfa' | 'treasure' | 'pill'

/** 超前多少个大境界的货物仍以「线索」形式挂在货架上（更远的彻底不现） */
export const MARKET_CLUE_LOOKAHEAD = 2

export interface MarketStockEntry {
  id: string
  status: MarketEntryStatus
}

/**
 * 某境界、某分区下的货架（R-14：纯函数，UI 与测试共用）。
 * 可成交货物正常上架；超前 ≤ MARKET_CLUE_LOOKAHEAD 个大境界的货物只显示线索
 * （「与你无缘，需 XX 修为」），更远的货物不出现 —— 有探索感而不剧透终局。
 */
export function visibleStock(realm: RealmId, tab: MarketTab): MarketStockEntry[] {
  const cats = ['herb', 'material', 'gongfa', 'treasure', 'pill'] as const
  const seen = new Set<string>()
  const out: MarketStockEntry[] = []
  for (const id of cats.flatMap((c) => MARKET_STOCK[c])) {
    if (seen.has(id)) continue
    seen.add(id)
    if (tab !== 'all' && itemCategory(id) !== tab) continue
    const status = marketEntryStatus(id, realm)
    if (!status.ok && ri(status.minRealm) > ri(realm) + MARKET_CLUE_LOOKAHEAD) continue
    out.push({ id, status })
  }
  return out
}

/** 未达境界货物的线索文案（货架灰显用） */
export function marketClueText(minRealm: RealmId): string {
  return `此物与你无缘——需${REALMS[minRealm]?.name ?? minRealm}修为方可承受。`
}
