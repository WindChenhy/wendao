/**
 * 突破成功率规则（纯函数）：
 * store 的突破 action 只负责从状态解包各加成数值，聚合与钳制集中在此处，
 * 保证「判定成功率」与「日志展示成功率」永远同源。
 */
import { breakthroughRate } from '../breakthrough'
import { REALMS } from '../../data/realms'
import { heartDemonBreakthroughPenalty } from '../heartDemon'
import type { AptitudeId, ClassId, RealmId } from '../../types'

interface BreakthroughRateContext {
  classId: ClassId
  /** 兼修道途（可选）：与主修一并计入道途加成 */
  paths?: ClassId[]
  /** 灵根资质（用于灵根突破加成；缺省按杂灵根中性处理） */
  aptitude?: AptitudeId
  realm: RealmId
  /** 当前小层（缺省按 1 层处理）；用于判定是否为大境界冲关 */
  layer?: number
  /** 宗门加成（sect.bonus.breakthroughBonus） */
  sectBonus?: number
  /** 道侣护法加成（重伤为 0，由调用方结算） */
  spouseBonus?: number
  /** 道痕加成（daoBonuses().breakthroughBonus） */
  daoBonus?: number
  /** 认主法宝加成（基础 + 词条，同类不叠加） */
  treasureBonus?: number
  /** 突破丹药加成（金丹护道方案下传 0） */
  pillBonus?: number
  /** 渡劫令持有加成 */
  tribTokenBonus?: number
  /** 功法羁绊加成（可为负） */
  synergyBonus?: number
  /** 天劫方案修正（usedPlan.rateDelta） */
  planRateDelta?: number
  /** DLC/全局规则修正（currentRules().breakthroughRateDelta） */
  rulesRateDelta?: number
  /** R-24 心魔值（0–100）：每 10 点压 −1% 突破率 */
  heartDemon?: number
  /** R-28 所渡之劫的解法道具加成（持有对应解法道具时为正） */
  calamityBonus?: number
}

/** 最终成功率下限 */
export const BREAKTHROUGH_RATE_MIN = 5
/** 小境界冲关成功率上限（基础率自身在 breakthroughRate 内另有 5..92 钳制） */
export const BREAKTHROUGH_RATE_MAX = 95
/**
 * 大境界冲关成功率上限：跨大境界必逢天劫/大劫，丹药法宝只能护持、不能力保。
 * 否则「渡劫 6%」在满配加成下形同虚设。
 */
export const MAJOR_BREAKTHROUGH_RATE_MAX = 70

/**
 * 最终突破成功率：基础率（已含境界基础 + 道途/灵根加成与 5..92 钳制）
 * 之后各加成线性叠加（次序与历史实现一致），再整体钳制。
 * 小境界钳制到 5..95；跨大境界额外钳制到 5..70。
 */
export function breakthroughSuccessRate(ctx: BreakthroughRateContext): number {
  const stack =
    breakthroughRate(
      { classId: ctx.classId, paths: ctx.paths, aptitude: ctx.aptitude },
      ctx.realm,
    ) +
    (ctx.sectBonus ?? 0) +
    (ctx.spouseBonus ?? 0) +
    (ctx.daoBonus ?? 0) +
    (ctx.treasureBonus ?? 0) +
    (ctx.pillBonus ?? 0) +
    (ctx.tribTokenBonus ?? 0) +
    (ctx.synergyBonus ?? 0) +
    (ctx.planRateDelta ?? 0) +
    (ctx.rulesRateDelta ?? 0) +
    (ctx.calamityBonus ?? 0)
  // R-24：心魔压制突破率（每 10 点 −1%）
  const finalStack = stack - heartDemonBreakthroughPenalty(ctx.heartDemon)
  const maxLayers = REALMS[ctx.realm]?.layers ?? 9
  const isMajor = (ctx.layer ?? 1) >= maxLayers
  const cap = isMajor ? MAJOR_BREAKTHROUGH_RATE_MAX : BREAKTHROUGH_RATE_MAX
  return Math.min(cap, Math.max(BREAKTHROUGH_RATE_MIN, finalStack))
}
