/** 灵兽静态表与协战/岗位参数（数据：db/pets.json） */
import db from './db/pets.json'

type PetSkillId = 'pet_heal' | 'pet_debuff' | 'pet_shield'
export type PetJob = 'none' | 'farm' | 'guard'

interface PetDef {
  id: string
  name: string
  desc: string
  skillId: PetSkillId
  skillName: string
  skillDesc: string
  jobFlavor: PetJob[]
}

interface PetConfig {
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
const PET_BOND_MAX = cfg.bondMax
export const PET_ASSIST_CD = cfg.assistTurnCd
export const PET_ASSIST_DMG_MUL = cfg.assistDmgMul
const PET_ATTR_PER_LV = cfg.attrBonusPerLevel
export const PET_ATTR_CAP = cfg.attrBonusCap
export const PET_FARM_ASSIST_MUL = cfg.farmAssistMul
export const PET_GUARD_LOSS_REDUCE = cfg.guardLossReduce
export const PET_CAPTURE_PITY = cfg.capturePity
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
  /** 是否已突破（Lv.10 后可突破，激活 1.15 属性系数） */
  broken: boolean
  /** 出战开关：出战时才提供属性加成与协战 */
  fight: boolean
}


export function petExpNeed(level: number): number {
  return 20 * level * level
}

/** 协战属性加成（封顶 attrBonusCap；突破后才激活 1.15 系数；亲密度小幅加成触发率，不再叠属性） */
export function petAttrBonus(pet: PetState | null): number {
  if (!pet) return 0
  return Math.min(PET_ATTR_CAP, pet.level * PET_ATTR_PER_LV * (pet.broken ? 1.15 : 1))
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

/** 战斗属性包（atk/hp 分量；仅出战灵兽生效，两路各自封顶，合计不超过 attrBonusCap） */
export function petStatBonus(pet: PetState | null): { atk: number; hp: number } {
  if (!pet || !pet.fight) return { atk: 0, hp: 0 }
  const def = PET_MAP[pet.petId]
  if (!def) return { atk: 0, hp: 0 }
  const mul = petAttrBonus(pet)
  // 角色向：狐偏攻，兔/龟/雀偏血
  const atkBias = def.id === 'pet_fox' ? 1.2 : 0.6
  return {
    atk: Math.min(PET_ATTR_CAP, mul * atkBias),
    hp: Math.min(PET_ATTR_CAP, mul * (1.2 - atkBias * 0.4)),
  }
}
