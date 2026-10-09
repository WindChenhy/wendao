/**
 * 突破成功率规则（纯函数）：
 * store 的突破 action 只负责从状态解包各加成数值，聚合与钳制集中在此处，
 * 保证「判定成功率」与「日志展示成功率」永远同源。
 */
import { breakthroughRate } from '../breakthrough'
import type { ClassId, RealmId } from '../../types'

interface BreakthroughRateContext {
  classId: ClassId
  realm: RealmId
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
}

/** 最终成功率下限 */
export const BREAKTHROUGH_RATE_MIN = 5
/** 最终成功率上限（基础率自身在 breakthroughRate 内另有 5..92 钳制） */
export const BREAKTHROUGH_RATE_MAX = 95

/**
 * 最终突破成功率：基础率（已含境界基础 + 职业加成与 5..92 钳制）
 * 之后各加成线性叠加（次序与历史实现一致），再整体钳制到 5..95。
 */
export function breakthroughSuccessRate(ctx: BreakthroughRateContext): number {
  return Math.min(
    BREAKTHROUGH_RATE_MAX,
    Math.max(
      BREAKTHROUGH_RATE_MIN,
      breakthroughRate(ctx.classId, ctx.realm) +
        (ctx.sectBonus ?? 0) +
        (ctx.spouseBonus ?? 0) +
        (ctx.daoBonus ?? 0) +
        (ctx.treasureBonus ?? 0) +
        (ctx.pillBonus ?? 0) +
        (ctx.tribTokenBonus ?? 0) +
        (ctx.synergyBonus ?? 0) +
        (ctx.planRateDelta ?? 0) +
        (ctx.rulesRateDelta ?? 0),
    ),
  )
}
