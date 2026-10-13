import { APTITUDES, DEFAULT_APTITUDE } from '../../data/aptitudes'
import { isDemonic, playerMults } from '../../data/classes'
import { DEFAULT_ORIGIN, ORIGINS } from '../../data/origins'
import { REALMS, realmMaxHp, realmMaxEnergy } from '../../data/realms'
import { gongfaBonuses, treasureBonus } from '../../game/combatStats'
import { applyDaoToMaxHp } from '../../game/reincarnate'
import type { CharacterCreateInput, GongfaLearned, LegacyState, PlayerState } from '../../types'
import type { MetaGet } from '../gameState'
import { currentRules } from './shared'

/**
 * 新角色：只定灵根与出身，不择道途。
 * 道途（主修/兼修）在修行途中立下，故 classId 起始为 'none'、paths 为空。
 */
export function freshPlayer(input: CharacterCreateInput, legacy: LegacyState): PlayerState {
  const apt = APTITUDES[input.aptitude] ?? APTITUDES[DEFAULT_APTITUDE]
  const origin = ORIGINS[input.origin] ?? ORIGINS[DEFAULT_ORIGIN]
  const mults = playerMults({ classId: 'none', paths: [], aptitude: apt.id })
  const maxHp = applyDaoToMaxHp(realmMaxHp('qi', mults.hpMul), legacy.daoMarks)
  const maxEnergy = realmMaxEnergy('qi', false)
  return {
    name: input.name.trim() || '无名',
    gender: input.gender,
    classId: 'none',
    paths: [],
    aptitude: apt.id,
    origin: origin.id,
    realm: 'qi',
    layer: 1,
    exp: 0,
    hp: maxHp,
    maxHp,
    energy: maxEnergy,
    maxEnergy,
    shaqi: 0,
    age: 16,
    lifespanLeft: Math.floor(
      REALMS.qi.lifespan * (1 + Math.min(0.3, legacy.daoMarks * 0.001)) * currentRules().lifespanMul,
    ),
    repRight: 5,
    repDemonic: 0,
    alive: true,
    ascended: false,
  }
}

/** 出身起始灵石 */
export function originStartStones(input: CharacterCreateInput): number {
  return (ORIGINS[input.origin] ?? ORIGINS[DEFAULT_ORIGIN]).startStones
}

/** 出身起始行囊 */
export function originStartItems(input: CharacterCreateInput): Record<string, number> {
  return { ...(ORIGINS[input.origin] ?? ORIGINS[DEFAULT_ORIGIN]).startItems }
}

/** 按道途/灵根、功法/法宝加成与道痕重算气血灵力上限（参悟、进阶、突破、立道、法宝变动后调用） */
export function recomputeVitals(
  get: MetaGet,
  p: PlayerState,
  treasures: string[],
  gongfaLearned: Record<string, GongfaLearned>,
  daoMarks: number,
  /** 功法适用境界的门槛判定值：调用点显式传入（突破时传突破前境界，与历史行为一致） */
  realm: PlayerState['realm'] | undefined,
): PlayerState {
  const m = playerMults(p)
  const gb = gongfaBonuses(gongfaLearned, realm)
  const tb = treasureBonus(treasures, get().artifacts)
  const baseHp = realmMaxHp(p.realm, m.hpMul, p.layer)
  const maxHp = applyDaoToMaxHp(Math.floor(baseHp * gb.hp * tb.hp), daoMarks)
  const maxEnergy = realmMaxEnergy(p.realm, isDemonic(p), p.layer)
  return {
    ...p,
    maxHp,
    maxEnergy,
    hp: Math.min(p.hp, maxHp),
    energy: Math.min(p.energy, maxEnergy),
  }
}

/** 按当前境界/道途/功法/法宝/道痕推导的气血上限（读档补足用） */
export function playerMaxHpCap(
  get: MetaGet,
  p: PlayerState,
  treasures: string[],
  gongfaLearned: Record<string, GongfaLearned>,
  daoMarks: number,
  realm: PlayerState['realm'] | undefined,
): number {
  return recomputeVitals(get, p, treasures, gongfaLearned, daoMarks, realm).maxHp
}
