/** 灵兽静态表与协战/岗位参数（数据：db/pets.json） */
import db from './db/pets.json'

export type PetSkillId = 'pet_heal' | 'pet_debuff' | 'pet_shield'
export type PetJob = 'none' | 'farm' | 'guard'

export interface PetDef {
  id: string
  name: string
  desc: string
  skillId: PetSkillId
  skillName: string
  skillDesc: string
  jobFlavor: PetJob[]
}

export interface PetConfig {
  pets: PetDef[]
  maxLevel: number
  breakLevel: number
  bondMax: number
  assistTurnCd: number
  assistDmgMul: number
  attrBonusPerLevel: number
  attrBonusCap: number
  farmAssistMul: number
  guardLossReduce: number
  captureBaseRate: number
  capturePity: number
  feedExpPerItem: number
}

const cfg = db as PetConfig
export const PETS: PetDef[] = cfg.pets
export const PET_MAP: Record<string, PetDef> = Object.fromEntries(PETS.map((p) => [p.id, p]))
export const PET_MAX_LEVEL = cfg.maxLevel
export const PET_BREAK_LEVEL = cfg.breakLevel
export const PET_BOND_MAX = cfg.bondMax
export const PET_ASSIST_CD = cfg.assistTurnCd
export const PET_ASSIST_DMG_MUL = cfg.assistDmgMul
export const PET_ATTR_PER_LV = cfg.attrBonusPerLevel
export const PET_ATTR_CAP = cfg.attrBonusCap
export const PET_FARM_ASSIST_MUL = cfg.farmAssistMul
export const PET_GUARD_LOSS_REDUCE = cfg.guardLossReduce
export const PET_CAPTURE_RATE = cfg.captureBaseRate
export const PET_FEED_EXP = cfg.feedExpPerItem

export interface PetState {
  petId: string
  name: string
  level: number
  exp: number
  bond: number
  job: PetJob
  /** 今日岗位日 key */
  jobOn: string
  /** 重伤休养至日序（软失败，可恢复） */
  restUntilDay: number
  /** 捕捉软保底计数 */
  captureFails: number
}


export function petExpNeed(level: number): number {
  return 20 * level * level
}

/** 协战属性加成（封顶 attrBonusCap；亲密度小幅加成触发率，不再叠属性） */
export function petAttrBonus(pet: PetState | null): number {
  if (!pet) return 0
  return Math.min(PET_ATTR_CAP, pet.level * PET_ATTR_PER_LV * (pet.level >= PET_BREAK_LEVEL ? 1.15 : 1))
}

/** 协战触发率：基础 0.55 + 亲密度 0～0.1 */
export function petAssistChance(pet: PetState | null): number {
  if (!pet) return 0
  return Math.min(0.75, 0.55 + (pet.bond / PET_BOND_MAX) * 0.1)
}

export function describePet(pet: PetState): string {
  const def = PET_MAP[pet.petId]
  return `${pet.name}（${def?.name ?? pet.petId}）Lv.${pet.level} · 亲密 ${pet.bond}`
}

/** 战斗属性包（atk/hp 分量） */
export function petStatBonus(pet: PetState | null): { atk: number; hp: number } {
  const mul = petAttrBonus(pet)
  const def = pet ? PET_MAP[pet.petId] : null
  if (!pet || !def) return { atk: 0, hp: 0 }
  // 角色向：狐/蛟偏攻，兔/龟偏血
  const atkBias = def.id === 'pet_fox' || def.id === 'pet_dragon' ? 1.2 : 0.6
  return { atk: mul * atkBias, hp: mul * (1.2 - atkBias * 0.4) }
}
