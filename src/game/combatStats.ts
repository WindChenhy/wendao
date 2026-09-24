/** 法宝/功法/战斗数值计算（纯函数，可单测） */
import { GONGFA_STAGE_MUL, GONGFAS, gongfaInScope } from '../data/gongfa'
import { activeSynergies, synergyBonus } from '../data/gongfaSynergy'
import { TREASURE_BONUS } from '../data/items'
import {
  artifactBreakthroughBonus,
  artifactCombatBonus,
  artifactOfflineMul,
  type ArtifactInstance,
} from '../data/artifacts'
import type { RealmId } from '../types'
import type { GongfaLearned } from '../stores/gameStateTypes'

/** 法宝加成：基础 TREASURE_BONUS + 词条（同类只计 active 一件） */
export function treasureBonus(treasures: string[], artifacts?: ArtifactInstance[]) {
  let atk = 1
  let def = 1
  let hp = 1
  const seen = new Set<string>()
  for (const id of treasures) {
    if (seen.has(id)) continue
    const b = TREASURE_BONUS[id]
    if (!b) continue
    seen.add(id)
    if (b.atk) atk *= 1 + b.atk
    if (b.def) def *= 1 + b.def
    if (b.hp) hp *= 1 + b.hp
  }
  if (artifacts && artifacts.length > 0) {
    const cb = artifactCombatBonus(artifacts)
    atk *= cb.atk
    def *= cb.def
    hp *= cb.hp
  }
  return { atk, def, hp }
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

/** 认主突破加成（基础 + 词条） */
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
  return bonus
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
