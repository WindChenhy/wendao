import { REALMS, realmIndex } from './realms'
import type { RealmId } from '../types'
import gongfaJson from './db/gongfa.json'

/** 功法品阶：黄 < 玄 < 地 < 天 < 仙 */
export type GongfaGrade = '黄阶' | '玄阶' | '地阶' | '天阶' | '仙阶'

/** 功法类型：心法主修行、攻击法诀主攻伐、防御法主护身、身法主遁走、锻体法炼体魄 */
export type GongfaKind = '心法' | '攻击法诀' | '防御法' | '身法' | '锻体法' | '功法'

interface GongfaDef {
  id: string
  name: string
  grade: GongfaGrade
  kind: GongfaKind
  desc: string
  /** 起步修炼大境界门槛（达到该大境界方可参悟） */
  minRealm: RealmId
  /** 适用范围上限：超过后本功法不再生效（留空 = 不限） */
  maxRealm?: RealmId
  /** 坊市秘籍售价；宗门秘法为 0（以贡献参悟） */
  price: number
  /** 圆满时的加成（按阶段系数缩放）；dodge 为受到伤害降低比例 */
  effect: { atk?: number; def?: number; hp?: number; cultivate?: number; dodge?: number }
}

/**
 * v1.7 数值平衡 · 功法修为消耗的**境界系数**（按功法起步大境界取）。
 *
 * 背景：旧版 `gongfaAdvanceCost` 只由品阶决定，天阶恒为「1万/3万/6万」，
 * 于是化神到渡劫五个大境界共用一口价——后期一次闭关就是百万级修为，
 * 推一部天阶功法到圆满只花 6 万，修为彻底溢出，功法养成失去重量。
 *
 * 方案：消耗 = 品阶基准 × **境界系数** × 阶段倍率。
 * 境界系数自元婴起按 ≈1.95^(境界序号-2) 抬升（取整成台阶）：
 *   练气/筑基/金丹 1 → 元婴 1.8 → 化神 3.2 → 炼虚 6.5 → 合体 13 → 大乘 28 → 渡劫 58
 * 前中期（练气～金丹）系数恒为 1，与旧版完全一致，前期节奏不受影响；
 * 后期一部天阶功法推到圆满约 280 万（大乘）/ 580 万（渡劫），
 * 单是「大成→圆满」一步就要 168 万 / 348 万，
 * 与同期「一次闭关百万级」维持同一量级，始终是需要攒的投入。
 *
 * 为什么不直接锚 expNeeded（≈5.88^境界）：那条曲线涨得比修为产出（≈1.32^境界）快得多，
 * 照它定价会让后期一部功法吃掉数层的修为，反而成了新的断档。
 */
export const GONGFA_REALM_EXP_MUL: Record<RealmId, number> = {
  qi: 1,
  foundation: 1,
  golden_core: 1,
  nascent_soul: 1.8,
  spirit_sea: 3.2,
  void: 6.5,
  integration: 13,
  mahayana: 28,
  tribulation: 58,
  ascended: 58,
}

/** 参悟（学习）修为门槛 = 入门→小成 的一半：入门先付半次进阶的修为 */
export const GONGFA_COMPREHEND_MUL = 0.5

/** 品阶由低到高 */
export const GONGFA_GRADE_ORDER: GongfaGrade[] = ['黄阶', '玄阶', '地阶', '天阶', '仙阶']
/** 品阶配色（面板用） */
export const GONGFA_GRADE_CLASS: Record<GongfaGrade, string> = {
  黄阶: 'text-text-dim',
  玄阶: 'text-jade',
  地阶: 'text-gold',
  天阶: 'text-vermilion',
  仙阶: 'text-gold',
}
/** 各品阶进阶基础消耗（修为点） */
const GONGFA_GRADE_ADVANCE_BASE: Record<GongfaGrade, number> = {
  黄阶: 200,
  玄阶: 800,
  地阶: 3000,
  天阶: 10000,
  仙阶: 40000,
}

/** 阶段标签与效果系数 */
export const GONGFA_STAGE_LABELS = ['入门', '小成', '大成', '圆满'] as const
export const GONGFA_STAGE_MUL = [0.5, 0.75, 1, 1.5] as const
/** 各级进阶消耗倍率：入门→小成、小成→大成、大成→圆满 */
const GONGFA_STAGE_ADVANCE_MUL = [1, 3, 6] as const

/** 该功法所在境界档的修为系数（脏数据回退 1） */
export function gongfaRealmExpMul(g: GongfaDef): number {
  return GONGFA_REALM_EXP_MUL[g.minRealm] ?? 1
}

/** 把功法从当前阶段推进到下一阶段所需修为（品阶基准 × 境界系数 × 阶段倍率） */
export function gongfaAdvanceCost(g: GongfaDef, stage: number): number {
  if (stage < 0 || stage >= GONGFA_STAGE_LABELS.length - 1) return 0
  return Math.floor(
    GONGFA_GRADE_ADVANCE_BASE[g.grade] * gongfaRealmExpMul(g) * GONGFA_STAGE_ADVANCE_MUL[stage],
  )
}

/**
 * 参悟（首次学习）这部功法所需修为。
 * 旧版参悟只吃一本秘籍、不花修为，导致「学」完全没有资源门槛；
 * v1.7 起按入门→小成的一半收修为，随境界同步抬升。
 */
export function gongfaComprehendCost(g: GongfaDef): number {
  return Math.floor(gongfaAdvanceCost(g, 0) * GONGFA_COMPREHEND_MUL)
}

/** 大境界门槛文案，如「需筑基」 */
export function gongfaRealmText(g: GongfaDef): string {
  return `需${REALMS[g.minRealm]?.name ?? g.minRealm}`
}

/** 玩家大境界是否达到功法起步要求 */
export function canLearnGongfa(g: GongfaDef, realm: RealmId): boolean {
  return realmIndex(realm) >= realmIndex(g.minRealm)
}

/**
 * 品阶随境界收紧（**只管"新获得"**：坊市可见性、藏经阁/残页参悟）：
 * 元婴以下：天地玄黄；元婴以上：天地玄；炼虚以上：天地；大乘及以上：仅天阶。
 * 仙阶为传世特例，仅大乘及以上可参悟，不进坊市常规池。
 *
 * 注意与 `gongfaInScope` 的分工（SPRINT_B R-07 曾把它当成自相矛盾）：
 * - `gongfaGradeOk`：**新参悟**时的门槛。大乘之后不能再新学低阶功法，属有意设计。
 * - `gongfaInScope`：**已参悟功法是否继续生效**。`maxRealm` 为空＝不设上限，永远生效。
 * 因此"大乘期不能再学一部不设上限的地阶功法"不是矛盾，而是"已学的继续有效、未学的门槛更高"。
 */
export function gongfaGradesAllowed(realm: RealmId): GongfaGrade[] {
  const i = realmIndex(realm)
  const nascent = realmIndex('nascent_soul')
  const xulian = realmIndex('void')
  const maha = realmIndex('mahayana')
  if (i >= maha) return ['天阶']
  if (i >= xulian) return ['地阶', '天阶']
  if (i >= nascent) return ['玄阶', '地阶', '天阶']
  return ['黄阶', '玄阶', '地阶', '天阶']
}

/** 该功法品阶是否允许在当前境界**新参悟**（已参悟者不受影响，见文件头注释） */
export function gongfaGradeOk(g: GongfaDef, realm: RealmId): boolean {
  if (g.grade === '仙阶') {
    // 传世仙经：仅大乘及以上可参悟（秘境/残页所得，不走坊市常规筛选）
    return realmIndex(realm) >= realmIndex('mahayana')
  }
  return gongfaGradesAllowed(realm).includes(g.grade)
}

/** 功法是否在当前境界**仍然生效**（`maxRealm` 为空 = 不设上限，永久生效） */
export function gongfaInScope(g: GongfaDef, realm: RealmId): boolean {
  if (!g.maxRealm) return true
  return realmIndex(realm) <= realmIndex(g.maxRealm)
}

/** 适用范围文案 */
export function gongfaScopeText(g: GongfaDef): string {
  const lo = REALMS[g.minRealm]?.name ?? g.minRealm
  const hi = g.maxRealm ? (REALMS[g.maxRealm]?.name ?? g.maxRealm) : '不设上限'
  return `适用 ${lo} → ${hi}`
}

/** 当前境界可学习（起步 + 品阶门槛） */
export function canLearnGongfaFull(g: GongfaDef, realm: RealmId): boolean {
  return canLearnGongfa(g, realm) && gongfaGradeOk(g, realm)
}

/** 功法内容表：src/data/db/gongfa.json */
export const GONGFA_LIST: GongfaDef[] = gongfaJson as GongfaDef[]

export const GONGFAS: Record<string, GongfaDef> = Object.fromEntries(
  GONGFA_LIST.map((g) => [g.id, g]),
)

/** 功法秘籍的物品 id（坊市购买、背包参悟） */
export function gongfaScrollId(gongfaId: string): string {
  return `scroll_${gongfaId}`
}

export function gongfaByScrollId(scrollItemId: string): GongfaDef | null {
  if (!scrollItemId.startsWith('scroll_')) return null
  return GONGFAS[scrollItemId.slice('scroll_'.length)] ?? null
}

/**
 * 坊市在售的功法（price > 0）。
 * price 为 0 的有两类，均不生成可交易秘籍：
 * - 宗门秘法（仅本宗藏经阁以贡献参悟）；
 * - 仙阶传世仙经（R-16：不进坊市常规池，仅大乘后由上宗藏经阁传承/残页/秘境获得）。
 */
export function isMarketGongfa(g: GongfaDef): boolean {
  return g.price > 0
}

/** 功法在当前阶段的加成倍率（0.5/0.75/1/1.5）；上下界均夹取，防脏数据下标越界得 undefined */
export function gongfaStageMul(stage: number): number {
  return GONGFA_STAGE_MUL[Math.min(GONGFA_STAGE_MUL.length - 1, Math.max(0, stage))]
}

/** 某一阶段下的加成文案，如 "攻击 +10%、气血 +5%" */
export function gongfaEffectText(g: GongfaDef, stage: number): string {
  const mul = gongfaStageMul(stage)
  const parts: string[] = []
  if (g.effect.atk) parts.push(`攻击 +${Math.round(g.effect.atk * mul * 100)}%`)
  if (g.effect.def) parts.push(`防御 +${Math.round(g.effect.def * mul * 100)}%`)
  if (g.effect.hp) parts.push(`气血 +${Math.round(g.effect.hp * mul * 100)}%`)
  if (g.effect.cultivate) parts.push(`修炼 +${Math.round(g.effect.cultivate * mul * 100)}%`)
  if (g.effect.dodge) parts.push(`受伤降低 ${Math.round(g.effect.dodge * mul * 100)}%`)
  return parts.join('、') || '—'
}

