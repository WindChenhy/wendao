/** 法宝/功法/战斗数值计算（纯函数，可单测）；旧版 combat.ts 的面板属性与击杀声望已并入此文件 */
import { isDemonic, playerMults, type PathInput } from '../data/classes'
import { GONGFA_STAGE_MUL, GONGFAS, gongfaInScope } from '../data/gongfa'
import { activeSynergies, synergyBonus } from '../data/gongfaSynergy'
import { TREASURE_BONUS } from '../data/items'
import { realmCombatBase } from '../data/realms'
import {
  artifactBreakthroughBonus,
  artifactCombatBonus,
  artifactOfflineMul,
  type ArtifactInstance,
} from '../data/artifacts'
import type { EnemyDef, GongfaLearned, RealmId } from '../types'

/** 法宝加成：基础 TREASURE_BONUS + 词条（同类只计 active 一件）；cultivate 为修炼乘区、dodge 为闪避概率（加算，消费端封顶） */
export function treasureBonus(treasures: string[], artifacts?: ArtifactInstance[]) {
  let atk = 1
  let def = 1
  let hp = 1
  let cultivate = 1
  let dodge = 0
  const seen = new Set<string>()
  for (const id of treasures) {
    if (seen.has(id)) continue
    const b = TREASURE_BONUS[id]
    if (!b) continue
    seen.add(id)
    if (b.atk) atk *= 1 + b.atk
    if (b.def) def *= 1 + b.def
    if (b.hp) hp *= 1 + b.hp
    if (b.cultivate) cultivate *= 1 + b.cultivate
    if (b.dodge) dodge += b.dodge
  }
  if (artifacts && artifacts.length > 0) {
    const cb = artifactCombatBonus(artifacts)
    atk *= cb.atk
    def *= cb.def
    hp *= cb.hp
  }
  return { atk, def, hp, cultivate, dodge }
}

/** 法宝词条额外战斗效果 */
export function artifactBattleExtras(artifacts?: ArtifactInstance[]) {
  if (!artifacts || artifacts.length === 0) {
    return { dmgReduce: 0, swordIntent: 0, counter: 0, skillMul: 1, offlineMul: 1 }
  }
  const cb = artifactCombatBonus(artifacts)
  return {
    dmgReduce: cb.dmgReduce,
    swordIntent: cb.swordIntent,
    counter: cb.counter,
    skillMul: cb.skillMul,
    offlineMul: artifactOfflineMul(artifacts),
  }
}

/**
 * 突破类法宝的全局累计上限（百分点）。
 * 报告核算：满配可持造化丹炉 4 + 悟道莲台 6 + 星斗罗盘 8 + 功德金环 10 + 昊天宝鉴 5 + 道韵青莲 12 = 45，
 * 线性叠加后把「渡劫 6%」抹平。故对"突破"这一通道单独设总量上限（见 SPRINT_B R-09 / 决策 D-2）。
 */
export const TREASURE_BREAKTHROUGH_CAP = 20

/** 认主突破加成（基础 + 词条；同类不叠加，且全局封顶 TREASURE_BREAKTHROUGH_CAP） */
export function treasureBreakthroughTotal(
  treasures: string[],
  artifacts?: ArtifactInstance[],
): number {
  let bonus = 0
  const seen = new Set<string>()
  for (const id of treasures) {
    if (seen.has(id)) continue
    const b = TREASURE_BONUS[id]
    if (b?.breakthrough) {
      seen.add(id)
      bonus += b.breakthrough
    }
  }
  if (artifacts?.length) bonus += artifactBreakthroughBonus(artifacts)
  return Math.min(TREASURE_BREAKTHROUGH_CAP, bonus)
}

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

/** 面板展示用战斗属性（道途 + 灵根合并倍率） */
export function playerCombatStats(
  paths: PathInput,
  realm: RealmId,
  layer: number,
  hp: number,
  maxHp: number,
  atkMul = 1,
  defMul = 1,
): Combatant {
  const c = playerMults(paths)
  const base = realmCombatBase(realm, layer)
  return {
    name: '你',
    atk: Math.floor(base.atk * c.atkMul * atkMul),
    def: Math.floor(base.def * c.defMul * defMul),
    hp,
    maxHp,
    isDemon: isDemonic(paths),
    dmgReduce: 0,
  }
}

/**
 * 击杀对正/魔声望的影响（对称结算）：
 * 斩魔除异扬正道之名，屠戮正道修士则损正道声望、堕入魔道之名。
 */
export function repDeltaOnKill(enemy: EnemyDef): { right: number; demonic: number } {
  if (enemy.faction === 'demonic') return { right: 8, demonic: -12 }
  if (enemy.faction === 'abomination') return { right: 6, demonic: -4 }
  if (enemy.faction === 'beast') return { right: 3, demonic: 0 }
  if (enemy.faction === 'rogue') return { right: 4, demonic: 0 }
  // righteous：同道相残
  return { right: -10, demonic: 4 }
}

/** 已参悟功法的加成（按阶段系数缩放，圆满 1.5 倍）；含羁绊；超适用范围失效 */
export function gongfaBonuses(learned: Record<string, GongfaLearned>, realm?: RealmId | string) {
  let atk = 1
  let def = 1
  let hp = 1
  let cultivate = 1
  let dodge = 0
  const activeIds: string[] = []
  for (const [id, st] of Object.entries(learned)) {
    const g = GONGFAS[id]
    if (!g) continue
    if (realm && !gongfaInScope(g, realm as RealmId)) continue
    activeIds.push(id)
    const mul = GONGFA_STAGE_MUL[Math.min(GONGFA_STAGE_MUL.length - 1, st.stage)]
    if (g.effect.atk) atk *= 1 + g.effect.atk * mul
    if (g.effect.def) def *= 1 + g.effect.def * mul
    if (g.effect.hp) hp *= 1 + g.effect.hp * mul
    if (g.effect.cultivate) cultivate *= 1 + g.effect.cultivate * mul
    if (g.effect.dodge) dodge += g.effect.dodge * mul
  }
  const syn = synergyBonus(activeIds)
  atk *= 1 + syn.atk
  def *= 1 + syn.def
  hp *= 1 + syn.hp
  cultivate *= 1 + syn.cultivate
  dodge += syn.dodge
  return {
    atk,
    def,
    hp,
    cultivate,
    dodge,
    breakthrough: syn.breakthrough,
    synergies: activeSynergies(activeIds),
  }
}
