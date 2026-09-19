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

export interface CombatRound {
  text: string
}

export interface CombatResult {
  win: boolean
  rounds: CombatRound[]
  playerHpLeft: number
  expGain: number
  stoneGain: number
  itemId?: string
  message: string
}

export function playerCombatStats(
  classId: ClassId,
  realm: RealmId,
  layer: number,
  hp: number,
  maxHp: number,
  atkMul = 1,
  defMul = 1,
  dmgReduce = 0,
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
    dmgReduce,
  }
}

function enemyToCombatant(e: EnemyDef): Combatant {
  return {
    name: e.name,
    atk: e.atk,
    def: e.def,
    hp: e.hp,
    maxHp: e.hp,
    isDemon: e.faction === 'demonic',
  }
}

/** 原始伤害：可为负（攻击被防御完全压制时格挡，不造成伤害） */
function rawDmg(atk: number, def: number): number {
  return Math.floor(atk - def * 0.55 + (Math.random() * 8 - 3))
}

export function runCombat(player: Combatant, enemy: EnemyDef): CombatResult {
  const e = enemyToCombatant(enemy)
  const rounds: CombatRound[] = []
  let pHp = player.hp
  let eHp = e.hp
  const demonLifesteal = player.isDemon ? 0.18 : 0

  for (let i = 0; i < 40; i++) {
    const d1 = rawDmg(player.atk, e.def)
    if (d1 <= 0) {
      rounds.push({ text: `你的攻势被${e.name}挡下，未伤分毫。` })
    } else {
      eHp = Math.max(0, eHp - d1)
      let text = `你对${e.name}造成 ${d1} 点伤害。`
      if (demonLifesteal > 0) {
        const heal = Math.floor(d1 * demonLifesteal)
        if (heal > 0) {
          pHp = Math.min(player.maxHp, pHp + heal)
          text += ` 煞气反哺，回复 ${heal} 气血。`
        }
      }
      rounds.push({ text })
      if (eHp <= 0) {
        return {
          win: true,
          rounds,
          playerHpLeft: pHp,
          expGain: enemy.loot.exp ?? 0,
          stoneGain: enemy.loot.stone ?? 0,
          itemId: enemy.loot.itemId,
          message: `${e.name}倒下了。`,
        }
      }
    }

    const d2 = rawDmg(e.atk, player.def)
    if (d2 <= 0) {
      rounds.push({ text: `${e.name}的攻势被你轻易格挡。` })
      continue
    }
    pHp = Math.max(0, pHp - d2)
    rounds.push({ text: `${e.name}对你造成 ${d2} 点伤害。` })
    if (pHp <= 0) {
      return {
        win: false,
        rounds,
        playerHpLeft: 0,
        expGain: 0,
        stoneGain: 0,
        message: '你力竭倒地，仓皇撤出战场。',
      }
    }
  }

  return {
    win: eHp < pHp,
    rounds,
    playerHpLeft: pHp,
    expGain: enemy.loot.exp ?? 0,
    stoneGain: enemy.loot.stone ?? 0,
    itemId: enemy.loot.itemId,
    message: '缠斗许久，双方暂退。',
  }
}

export function repDeltaOnKill(enemy: EnemyDef): { right: number; demonic: number } {
  if (enemy.faction === 'demonic') return { right: 8, demonic: -12 }
  if (enemy.faction === 'beast') return { right: 3, demonic: 0 }
  return { right: 0, demonic: 4 }
}