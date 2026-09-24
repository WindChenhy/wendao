import { REALMS, realmIndex } from './realms'
import type { RealmId } from '../types'
import gongfaJson from './db/gongfa.json'

/** 功法品阶：黄 < 玄 < 地 < 天 < 仙 */
export type GongfaGrade = '黄阶' | '玄阶' | '地阶' | '天阶' | '仙阶'

/** 功法类型：心法主修行、攻击法诀主攻伐、防御法主护身、身法主遁走、锻体法炼体魄 */
export type GongfaKind = '心法' | '攻击法诀' | '防御法' | '身法' | '锻体法' | '功法'

/** 修习阶段：入门 → 小成 → 大成 → 圆满 */
export type GongfaStage = 0 | 1 | 2 | 3

export interface GongfaDef {
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
export const GONGFA_GRADE_ADVANCE_BASE: Record<GongfaGrade, number> = {
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
export const GONGFA_STAGE_ADVANCE_MUL = [1, 3, 6] as const

/** 把功法从当前阶段推进到下一阶段所需修为 */
export function gongfaAdvanceCost(g: GongfaDef, stage: number): number {
  if (stage < 0 || stage >= GONGFA_STAGE_LABELS.length - 1) return 0
  return GONGFA_GRADE_ADVANCE_BASE[g.grade] * GONGFA_STAGE_ADVANCE_MUL[stage]
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
 * 品阶随境界收紧（学习/坊市可见）：
 * 元婴以下：天地玄黄；元婴以上：天地玄；炼虚以上：天地；大乘及以上：仅天阶。
 * 仙阶为传世特例，仅渡劫/飞升相关可持有，不进常规池。
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

/** 该功法品阶是否允许在当前境界出现/参悟 */
export function gongfaGradeOk(g: GongfaDef, realm: RealmId): boolean {
  if (g.grade === '仙阶') {
    // 传世仙经：仅大乘及以上可参悟（秘境/残页所得，不走坊市常规筛选）
    return realmIndex(realm) >= realmIndex('mahayana')
  }
  return gongfaGradesAllowed(realm).includes(g.grade)
}

/** 是否在适用范围内（超过 maxRealm 则失效） */
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

/** 坊市在售的功法（宗门秘法 price 为 0，仅藏经阁贡献参悟） */
export function isMarketGongfa(g: GongfaDef): boolean {
  return g.price > 0
}

/** 功法在当前阶段的加成倍率（0.5/0.75/1/1.5） */
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

