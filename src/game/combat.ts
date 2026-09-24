/** 旧版回合互砍战斗已由 combatEngine 取代；本模块仅保留面板属性与击杀声望。 */
import { CLASSES } from '../data/classes'
import { realmCombatBase } from '../data/realms'
import type { ClassId, EnemyDef, RealmId } from '../types'

interface Combatant {
  name: string
  atk: number
  def: number
  hp: number
  maxHp: number
  isDemon: boolean
  /** 受到伤害降低比例（身法类功法） */
  dmgReduce?: number
}

/** 面板展示用战斗属性 */
export function playerCombatStats(
  classId: ClassId,
  realm: RealmId,
  layer: number,
  hp: number,
  maxHp: number,
  atkMul = 1,
  defMul = 1,
): Combatant {
  const c = CLASSES[classId]
  const base = realmCombatBase(realm, layer)
  return {
    name: '你',
    atk: Math.floor(base.atk * c.atkMul * atkMul),
    def: Math.floor(base.def * c.defMul * defMul),
    hp,
    maxHp,
    isDemon: classId === 'demon',
    dmgReduce: 0,
  }
}

/** 击杀对正/魔声望的影响 */
export function repDeltaOnKill(enemy: EnemyDef): { right: number; demonic: number } {
  if (enemy.faction === 'demonic') return { right: 8, demonic: -12 }
  if (enemy.faction === 'beast') return { right: 3, demonic: 0 }
  return { right: 0, demonic: 4 }
}
