import { realmIndex } from '../data/realms'
import type { PlayerState } from '../types'

export interface ReincarnateGain {
  daoMarks: number
  desc: string
}

/** 本世可获得的道痕 */
export function reincarnateGain(player: PlayerState, hadSpouse: boolean): ReincarnateGain {
  const ri = player.ascended ? realmIndex('ascended') : realmIndex(player.realm)
  const realmPart = (ri + 1) * 8
  const agePart = Math.floor(player.age / 20)
  const spousePart = hadSpouse ? 12 : 0
  const ascendPart = player.ascended ? 40 : 0
  const daoMarks = realmPart + agePart + spousePart + ascendPart
  const bits = [
    `境界 ${realmPart}`,
    `寿龄 ${agePart}`,
    spousePart > 0 ? `道缘 ${spousePart}` : null,
    ascendPart > 0 ? `飞升 ${ascendPart}` : null,
  ].filter(Boolean)
  return { daoMarks, desc: bits.join(' · ') }
}

/** 道痕永久加成（下一世） */
export function daoBonuses(daoMarks: number) {
  return {
    cultivateMul: 1 + Math.min(0.5, daoMarks * 0.004),
    breakthroughBonus: Math.min(15, Math.floor(daoMarks * 0.15)),
    startStones: Math.min(500, 20 + Math.floor(daoMarks * 2)),
    startPlotsBonus: Math.min(2, Math.floor(daoMarks / 40)),
  }
}

/** 创建新角色时的道痕修正气血 */
export function applyDaoToMaxHp(baseHp: number, daoMarks: number): number {
  const mul = 1 + Math.min(0.25, daoMarks * 0.002)
  return Math.floor(baseHp * mul)
}
