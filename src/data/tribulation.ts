import tribulationDb from './db/tribulation.json'

/** v1.0 天劫选择：冲击大境界/渡劫时的冲关方案 */
export type TribulationPlanId = 'normal' | 'golden_pill' | 'spouse' | 'force'

interface TribulationPlanDef {
  id: TribulationPlanId
  name: string
  desc: string
  /** 成功率百分点修正 */
  rateDelta: number
  /** 失败惩罚降一档 */
  softenFail?: boolean
  /** 失败时道侣重伤 */
  spouseRisk?: boolean
  /** 成功时额外道痕 */
  extraDao?: number
  /** 需额外消耗的物品 */
  costItemId?: string
  costCount?: number
}

/** 冲关方案表：src/data/db/tribulation.json */
export const TRIBULATION_PLANS: TribulationPlanDef[] = tribulationDb as TribulationPlanDef[]

export function tribulationPlan(id: TribulationPlanId): TribulationPlanDef {
  return TRIBULATION_PLANS.find((p) => p.id === id) ?? TRIBULATION_PLANS[0]
}

/** 是否进入天劫选择：大境界突破或渡劫/大乘相关 */
export function isTribulationMoment(realm: string, layer: number, maxLayers: number): boolean {
  return layer >= maxLayers || realm === 'mahayana' || realm === 'tribulation'
}

/** 失败惩罚降一档：critical→major→minor */
export function softenSeverity(
  s: 'none' | 'minor' | 'major' | 'critical',
): 'none' | 'minor' | 'major' | 'critical' {
  if (s === 'critical') return 'major'
  if (s === 'major') return 'minor'
  return s
}
