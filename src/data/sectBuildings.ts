/** 宗门建筑与贡献池规则（数据：db/sect_buildings.json） */
import db from './db/sect_buildings.json'

export type SectBuildingId = 'spirit_vein' | 'alchemy_lab' | 'sword_grave'

export interface SectBuildingDef {
  id: SectBuildingId
  name: string
  desc: string
  maxLevel: number
  costBase: number
  costGrow: number
  effects: {
    cultivatePerLv?: number
    craftRatePerLv?: number
    atkPerLv?: number
    examAtkPerLv?: number
  }
}

export interface SectBuildingDb {
  buildings: SectBuildingDef[]
  donateStonesPerPool: number
  commissionPoolCut: number
}

const data = db as SectBuildingDb

export const SECT_BUILDINGS: SectBuildingDef[] = data.buildings
export const SECT_BUILDING_MAP: Record<string, SectBuildingDef> = Object.fromEntries(
  SECT_BUILDINGS.map((b) => [b.id, b]),
)
export const DONATE_STONES_PER_POOL = data.donateStonesPerPool
export const COMMISSION_POOL_CUT = data.commissionPoolCut

export function emptyBuildings(): Record<SectBuildingId, number> {
  return { spirit_vein: 0, alchemy_lab: 0, sword_grave: 0 }
}

export function buildingLevel(
  buildings: Record<string, number> | undefined,
  id: SectBuildingId,
): number {
  const def = SECT_BUILDING_MAP[id]
  const lv = Number(buildings?.[id]) || 0
  return Math.max(0, Math.min(def?.maxLevel ?? 5, lv))
}

export function buildingUpgradeCost(def: SectBuildingDef, level: number): number {
  return def.costBase * (level + 1) + def.costGrow * level * level
}

/** 全宗修炼额外乘区（灵脉） */
export function buildingCultivateMul(buildings: Record<string, number> | undefined): number {
  const lv = buildingLevel(buildings, 'spirit_vein')
  return 1 + (SECT_BUILDING_MAP.spirit_vein.effects.cultivatePerLv ?? 0) * lv
}

/** 炼丹成功率百分点加成（丹房） */
export function buildingCraftRateBonus(buildings: Record<string, number> | undefined): number {
  const lv = buildingLevel(buildings, 'alchemy_lab')
  return (SECT_BUILDING_MAP.alchemy_lab.effects.craftRatePerLv ?? 0) * 100 * lv
}

/** 战斗攻击乘区（剑冢）；isExam 时叠加大比加成 */
export function buildingAtkMul(
  buildings: Record<string, number> | undefined,
  opts?: { isExam?: boolean },
): number {
  const lv = buildingLevel(buildings, 'sword_grave')
  const def = SECT_BUILDING_MAP.sword_grave
  let mul = 1 + (def.effects.atkPerLv ?? 0) * lv
  if (opts?.isExam) mul += (def.effects.examAtkPerLv ?? 0) * lv
  return mul
}

export function describeBuildingEffect(def: SectBuildingDef, level: number): string {
  const parts: string[] = []
  const e = def.effects
  if (e.cultivatePerLv) parts.push(`修炼 +${Math.round(e.cultivatePerLv * level * 100)}%`)
  if (e.craftRatePerLv) parts.push(`炼丹成功率 +${Math.round(e.craftRatePerLv * level * 100)}%`)
  if (e.atkPerLv) parts.push(`攻击 +${Math.round(e.atkPerLv * level * 100)}%`)
  if (e.examAtkPerLv) parts.push(`大比攻击 +${Math.round(e.examAtkPerLv * level * 100)}%`)
  return parts.join('、') || '无'
}

/** 灵石 → 池（10:1） */
export function stonesToPool(stones: number): number {
  return Math.floor(Math.max(0, stones) / DONATE_STONES_PER_POOL)
}

/** 委托贡献抽成入池（10%） */
export function commissionPoolCutOf(contributionGain: number): number {
  return Math.floor(Math.max(0, contributionGain) * COMMISSION_POOL_CUT)
}
