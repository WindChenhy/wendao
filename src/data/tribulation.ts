import { realmIndex } from './realms'
import { heartDemonTribulation } from '../game/heartDemon'
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

/**
 * 劫类型（R-28）：三灾（雷/火/风）＋心魔劫。
 * 大境界冲关时按境界与心魔值抽 1–3 类；每类有对应「解法道具」降难度。
 * 与「冲关方案」正交：方案是应对方式，劫类型是所遇之劫。
 */
export interface CalamityDef {
  id: CalamityId
  name: string
  desc: string
  /** 解法道具（持有即降难度；缺省表示无解） */
  solutionItemId?: string
  /** 解法道具名（日志/UI） */
  solutionName?: string
  /** 持有解法道具时的成功率修正（百分点） */
  rateDelta?: number
  /** 可出现的最低大境界序号（心魔劫化神起掺入） */
  minRealmIndex?: number
}

export type CalamityId = 'lei' | 'huo' | 'feng' | 'xinmo'

interface TribulationDb {
  plans: TribulationPlanDef[]
  calamities: CalamityDef[]
}

const DB = tribulationDb as unknown as TribulationDb

/** 冲关方案表：src/data/db/tribulation.json（plans） */
export const TRIBULATION_PLANS: TribulationPlanDef[] = DB.plans

/** 劫类型表：src/data/db/tribulation.json（calamities） */
export const CALAMITIES: CalamityDef[] = DB.calamities

export function tribulationPlan(id: TribulationPlanId): TribulationPlanDef {
  return TRIBULATION_PLANS.find((p) => p.id === id) ?? TRIBULATION_PLANS[0]
}

export function calamityById(id: CalamityId): CalamityDef | null {
  return CALAMITIES.find((c) => c.id === id) ?? null
}

/**
 * 是否进入天劫方案选择。
 * 通行设定里天劫只属于大乘/渡劫阶段（`docs/DESIGN_v0.6_gameplay.md` 亦写"渡劫/大乘相关"）；
 * 练气→筑基之类的大境界冲关只是"壁垒碎裂"，不该弹出天劫方案（v1.5 前 `layer >= maxLayers`
 * 让练气九层也能选"金丹护道"，与设定冲突）。
 * 大乘/渡劫两境各层皆凶险，故整境开放方案选择。
 */
export function isTribulationMoment(realm: string): boolean {
  return realm === 'mahayana' || realm === 'tribulation'
}

/** 失败惩罚降一档：critical→major→minor */
export function softenSeverity(
  s: 'none' | 'minor' | 'major' | 'critical',
): 'none' | 'minor' | 'major' | 'critical' {
  if (s === 'critical') return 'major'
  if (s === 'major') return 'minor'
  return s
}

/** 抽劫结果 */
export interface DrawnCalamity {
  def: CalamityDef
  /** 玩家背包中是否持有该劫的解法道具 */
  hasSolution: boolean
}

/** 各境界序号对应的抽劫数目：低境 1、化神起 2、大乘起 3 */
export function calamityCountFor(realm: string): number {
  const ri = realmIndex(realm as never)
  if (ri >= realmIndex('mahayana')) return 3
  if (ri >= realmIndex('spirit_sea')) return 2
  return 1
}

/**
 * 抽劫（纯函数，rng 注入便于确定性测试）。
 * - 候选池：雷/火/风（minRealmIndex 达标者）；化神起掺入心魔劫；
 * - 心魔值 ≥60（心魔劫阈值）时，心魔劫必入池且优先被抽中；
 * - 按境界抽取 1–3 类，不重复。
 */
export function drawCalamities(
  realm: string,
  heartDemon: number,
  rng: () => number = Math.random,
): CalamityDef[] {
  const ri = realmIndex(realm as never)
  const pool = CALAMITIES.filter((c) => ri >= (c.minRealmIndex ?? 0))
  if (pool.length === 0) return []
  const count = Math.min(calamityCountFor(realm), pool.length)
  const out: CalamityDef[] = []
  // 心魔深重：心魔劫优先定下
  const xinmo = pool.find((c) => c.id === 'xinmo')
  if (xinmo && heartDemonTribulation(heartDemon)) {
    out.push(xinmo)
  }
  while (out.length < count) {
    const remain = pool.filter((c) => !out.includes(c))
    if (remain.length === 0) break
    const pick = remain[Math.floor(rng() * remain.length) % remain.length]
    out.push(pick)
  }
  return out
}

/** 汇总解法道具的突破率加成（持有即计入；逐个劫类型取一次，不叠加同类） */
export function calamitySolutionBonus(calamities: DrawnCalamity[]): number {
  let sum = 0
  for (const c of calamities) {
    if (c.hasSolution) sum += c.def.rateDelta ?? 0
  }
  return sum
}

/** 抽劫日志文案，如「此番所渡：雷灾（护心镜可解）、心魔劫」 */
export function calamityLogText(calamities: DrawnCalamity[]): string {
  const parts = calamities.map((c) =>
    c.hasSolution && c.def.solutionName
      ? `${c.def.name}（${c.def.solutionName}护持）`
      : c.def.solutionName
        ? `${c.def.name}（${c.def.solutionName}可解）`
        : c.def.name,
  )
  return `此番所渡：${parts.join('、')}。`
}
