import { CLASSES } from '../../data/classes'
import { REALMS, realmMaxHp, realmMaxEnergy } from '../../data/realms'
import { gongfaBonuses, treasureBonus } from '../../game/combatStats'
import { applyDaoToMaxHp } from '../../game/reincarnate'
import type { CharacterCreateInput, GongfaLearned, LegacyState, PlayerState } from '../../types'
import type { MetaGet } from '../gameState'
import { currentRules } from './shared'

export function freshPlayer(input: CharacterCreateInput, legacy: LegacyState): PlayerState {
  const c = CLASSES[input.classId]
  const maxHp = applyDaoToMaxHp(realmMaxHp('qi', c.hpMul), legacy.daoMarks)
  const maxEnergy = realmMaxEnergy('qi', input.classId === 'demon')
  return {
    name: input.name.trim() || '无名',
    gender: input.gender,
    classId: input.classId,
    realm: 'qi',
    layer: 1,
    exp: 0,
    hp: maxHp,
    maxHp,
    energy: maxEnergy,
    maxEnergy,
    shaqi: input.classId === 'demon' ? 10 : 0,
    age: 16,
    lifespanLeft: Math.floor(
      REALMS.qi.lifespan * (1 + Math.min(0.3, legacy.daoMarks * 0.001)) * currentRules().lifespanMul,
    ),
    repRight: input.classId === 'demon' ? -20 : 5,
    repDemonic: input.classId === 'demon' ? 40 : 0,
    alive: true,
    ascended: false,
  }
}

/** 按功法/法宝加成与道痕重算气血灵力上限（参悟、进阶、突破、法宝变动后调用） */
export function recomputeVitals(
  get: MetaGet,
  p: PlayerState,
  treasures: string[],
  gongfaLearned: Record<string, GongfaLearned>,
  daoMarks: number,
  /** 功法适用境界的门槛判定值：调用点显式传入（突破时传突破前境界，与历史行为一致） */
  realm: PlayerState['realm'] | undefined,
): PlayerState {
  const c = CLASSES[p.classId]
  const gb = gongfaBonuses(gongfaLearned, realm)
  const tb = treasureBonus(treasures, get().artifacts)
  const baseHp = realmMaxHp(p.realm, c.hpMul, p.layer)
  const maxHp = applyDaoToMaxHp(Math.floor(baseHp * gb.hp * tb.hp), daoMarks)
  const maxEnergy = realmMaxEnergy(p.realm, p.classId === 'demon', p.layer)
  return {
    ...p,
    maxHp,
    maxEnergy,
    hp: Math.min(p.hp, maxHp),
    energy: Math.min(p.energy, maxEnergy),
  }
}

/** 按当前境界/功法/法宝/道痕推导的气血上限（读档补足用） */
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
