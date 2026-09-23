/** v1.0 天劫选择：冲击大境界/渡劫时的冲关方案 */
export type TribulationPlanId = 'normal' | 'golden_pill' | 'spouse' | 'force'

export interface TribulationPlanDef {
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

export const TRIBULATION_PLANS: TribulationPlanDef[] = [
  {
    id: 'normal',
    name: '常规冲关',
    desc: '稳妥应劫，按当前成功率与混合惩罚规则。',
    rateDelta: 0,
  },
  {
    id: 'golden_pill',
    name: '金丹护道',
    desc: '多耗一枚渡劫金丹：成功率 +8%，失败惩罚降低一档。',
    rateDelta: 8,
    softenFail: true,
    costItemId: 'pill_break_trib',
    costCount: 1,
  },
  {
    id: 'spouse',
    name: '道侣护法',
    desc: '道侣在侧护持心脉：成功率 +6%；若失败道侣重伤，数日无法助战/代劳。',
    rateDelta: 6,
    spouseRisk: true,
  },
  {
    id: 'force',
    name: '强行冲关',
    desc: '逆天而行：成功率 -10%，成功则额外道痕 +3。',
    rateDelta: -10,
    extraDao: 3,
  },
]

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
