import type { ClassId, RealmId } from '../types'
import { realmIndex } from './realms'
import skillsDb from './db/skills.json'

export type SkillType = 'passive' | 'active'

export interface SkillEffect {
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

export interface CombatConfig {
  maxRounds: number
  defendDmgReduce: number
  defendEnergyRegen: number
  combatPotionLimit: number
  critBaseChance: number
  critMultiplier: number
  swordIntentPerStack: number
  swordIntentMax: number
  shaQiPerStack: number
  shaQiMax: number
  demonLifesteal: number
  enemySkillChance: Record<string, number>
  autoDefaultExplore: boolean
  autoDefaultSect: boolean
}

export const COMBAT_CONFIG: CombatConfig = skillsDb.combatConfig

export const SKILL_LIST: SkillDef[] = skillsDb.skills as SkillDef[]

export const SKILLS: Record<string, SkillDef> = Object.fromEntries(
  SKILL_LIST.map((s) => [s.id, s]),
)

export function skillsForClass(classId: ClassId): SkillDef[] {
  return SKILL_LIST.filter((s) => s.classId === classId)
}

export function activeSkillsForClass(classId: ClassId): SkillDef[] {
  return skillsForClass(classId).filter((s) => s.type === 'active')
}

export function passiveForClass(classId: ClassId): SkillDef | null {
  return skillsForClass(classId).find((s) => s.type === 'passive') ?? null
}

export function isSkillUnlocked(skill: SkillDef, realm: RealmId, layer: number): boolean {
  if (skill.type === 'passive') return true
  if (!skill.unlock) return true
  const need = realmIndex(skill.unlock.realm)
  const cur = realmIndex(realm)
  if (cur < need) return false
  if (cur === need && layer < skill.unlock.layer) return false
  return true
}

export function unlockedActiveSkills(classId: ClassId, realm: RealmId, layer: number): SkillDef[] {
  return activeSkillsForClass(classId).filter((s) => isSkillUnlocked(s, realm, layer))
}

export const ATTACK_TREASURES = new Set([
  'treasure_sword',
  'treasure_fan',
  'treasure_seal',
  'treasure_sword_imm',
  'treasure_ropes',
])
export const DEF_TREASURES = new Set([
  'treasure_mirror',
  'treasure_pagoda',
  'treasure_bell',
  'treasure_net',
  'treasure_mirror_imm',
  'treasure_umbrella',
  'treasure_pagoda9',
])
