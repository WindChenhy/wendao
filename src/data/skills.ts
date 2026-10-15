import type { ClassId, RealmId } from '../types'
import { TREASURE_BONUS } from './items'
import { realmIndex } from './realms'
import skillsDb from './db/skills.json'

type SkillType = 'passive' | 'active'

interface SkillEffect {
  type: string
  status?: string
  stacks?: number
  value?: number
  turns?: number
  target?: 'self' | 'enemy'
  perHit?: boolean
  ratio?: number
  flat?: number
  chance?: number
  bonusPerStack?: number
  threshold?: number
  per?: number
  gain?: number
  years?: number
  strongMul?: number
  weakMul?: number
  strongRatio?: number
  weakRatio?: number
  energyGain?: number
  extraLimit?: number
  capAtk?: number
  multiplier?: number
}

export interface SkillDef {
  id: string
  classId: ClassId
  name: string
  type: SkillType
  unlock?: { realm: RealmId; layer: number }
  cost?: {
    energy?: number
    talismanChargeAlt?: { charge: number; energy: number }
  }
  cd?: number
  hits?: number
  multiplier?: number
  defPierce?: number
  autoPriority?: number
  desc: string
  effects?: SkillEffect[]
}

interface CombatConfig {
  maxRounds: number
  defendDmgReduce: number
  defendEnergyRegen: number
  /** 受伤降低 dmgReduce 上限（功法 dodge 累加与法宝词条共用同一槽位，须封顶防无敌） */
  dmgReduceCap: number
  combatPotionLimit: number
  critBaseChance: number
  critMultiplier: number
  swordIntentPerStack: number
  swordIntentMax: number
  shaQiPerStack: number
  shaQiMax: number
  demonLifesteal: number
  enemySkillChance: Record<string, number>
}

export const COMBAT_CONFIG: CombatConfig = skillsDb.combatConfig

const SKILL_LIST: SkillDef[] = skillsDb.skills as SkillDef[]

export const SKILLS: Record<string, SkillDef> = Object.fromEntries(
  SKILL_LIST.map((s) => [s.id, s]),
)

export function skillsForClass(classId: ClassId): SkillDef[] {
  return SKILL_LIST.filter((s) => s.classId === classId)
}

/** 道途集合（主修在前）可用的全部技能：主修与兼修同等可用，技能强弱由道途属性折扣体现 */
export function skillsForPaths(paths: ClassId[]): SkillDef[] {
  const set = new Set(paths)
  return SKILL_LIST.filter((s) => set.has(s.classId))
}

export function passivesForPaths(paths: ClassId[]): SkillDef[] {
  return skillsForPaths(paths).filter((s) => s.type === 'passive')
}

function activeSkillsForClass(classId: ClassId): SkillDef[] {
  return skillsForClass(classId).filter((s) => s.type === 'active')
}

export function passiveForClass(classId: ClassId): SkillDef | null {
  return skillsForClass(classId).find((s) => s.type === 'passive') ?? null
}

export interface SkillUnlockOpts {
  /** 技能是否来自兼修道途（非主修） */
  isSecondary?: boolean
  /** 主修玩家的当前大境界（isSecondary 时用作「道行压制」判定） */
  primaryRealm?: RealmId
}

/**
 * 主动技是否已领悟。
 * R-22：兼修之技额外受「主修境界 − 1」上限制约——道行不够，压不住旁门：
 * 兼修技能的领悟境界不得高于主修当前大境界的上一境（只比大境界，不看小层）。
 */
export function isSkillUnlocked(
  skill: SkillDef,
  realm: RealmId,
  layer: number,
  opts?: SkillUnlockOpts,
): boolean {
  if (skill.type === 'passive') return true
  if (!skill.unlock) return true
  const need = realmIndex(skill.unlock.realm)
  const cur = realmIndex(realm)
  if (cur < need) return false
  if (cur === need && layer < skill.unlock.layer) return false
  if (opts?.isSecondary && opts.primaryRealm) {
    if (need > realmIndex(opts.primaryRealm) - 1) return false
  }
  return true
}

export function unlockedActiveSkills(classId: ClassId, realm: RealmId, layer: number): SkillDef[] {
  return activeSkillsForClass(classId).filter((s) => isSkillUnlocked(s, realm, layer))
}

/**
 * 道途集合下已领悟的主动技（主修 + 兼修，按道途顺序）。
 * 传 primaryRealm 时启用 R-22 兼修压制：paths 首位为主修，其余道途的技能按「主修境界−1」封顶。
 */
export function unlockedActiveSkillsForPaths(
  paths: ClassId[],
  realm: RealmId,
  layer: number,
  primaryRealm?: RealmId,
): SkillDef[] {
  const primary = paths[0]
  return skillsForPaths(paths).filter(
    (s) =>
      s.type === 'active' &&
      isSkillUnlocked(s, realm, layer, {
        isSecondary: primaryRealm !== undefined && s.classId !== primary,
        primaryRealm,
      }),
  )
}

/** R-22：兼修技能的境界封顶（主修境界的上一大境界序号）；主修技能无此限制 */
export function secondarySkillCapRealm(primaryRealm: RealmId): number {
  return realmIndex(primaryRealm) - 1
}

/**
 * 器道被动的攻/防分类：由法宝数据派生（items.json → TREASURE_BONUS 的 atk / def 通道）。
 * 原先为 11 个 id 的手工集合，与 25 件法宝靠人工同步 —— 新增法宝漏登记即静默失去器道加成。
 * 纯修炼/突破类法宝（既无 atk 也无 def）两边都不入，器道被动不为其加成。
 */
export const ATTACK_TREASURES = new Set(
  Object.keys(TREASURE_BONUS).filter((id) => (TREASURE_BONUS[id]?.atk ?? 0) > 0),
)
export const DEF_TREASURES = new Set(
  Object.keys(TREASURE_BONUS).filter(
    (id) => (TREASURE_BONUS[id]?.atk ?? 0) <= 0 && (TREASURE_BONUS[id]?.def ?? 0) > 0,
  ),
)
