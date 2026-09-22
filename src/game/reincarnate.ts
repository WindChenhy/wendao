import { realmIndex } from '../data/realms'
import type { PlayerState } from '../types'

/** 是否已飞升：以境界为准，兼容旧档未写入 ascended 标志的情况 */
export function isAscended(player: Pick<PlayerState, 'realm' | 'ascended'> | null): boolean {
  if (!player) return false
  return player.ascended || player.realm === 'ascended'
}

/** 一世是否已终局（飞升或道消）——二者互斥，飞升优先 */
export function isLifeEnded(player: PlayerState | null): boolean {
  if (!player) return false
  if (isAscended(player)) return true
  return !player.alive
}

export interface ReincarnateGain {
  daoMarks: number
  desc: string
}

/** 本世可获得的道痕 */
export function reincarnateGain(player: PlayerState, hadSpouse: boolean): ReincarnateGain {
  const ascended = isAscended(player)
  const ri = ascended ? realmIndex('ascended') : realmIndex(player.realm)
  const realmPart = (ri + 1) * 8
  const agePart = Math.floor(player.age / 20)
  const spousePart = hadSpouse ? 12 : 0
  const ascendPart = ascended ? 40 : 0
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

/** 存档导出文件名：区分转生次数；年号标注为「本世」（转生后从第 1 年重计） */
export function buildSaveFileName(opts: {
  name: string
  year: number
  month: number
  day: number
  reincarnations: number
}): string {
  const rei = Math.max(0, opts.reincarnations)
  const reiTag = rei > 0 ? `_转生${rei}次` : ''
  const yearTag = rei > 0 ? `本世第${opts.year}年` : `第${opts.year}年`
  return `存档_${opts.name}${reiTag}_${yearTag}${opts.month}月${opts.day}日.wdsave`
}

/** 导出备注：说明转生次数与年纪规则 */
export function describeSaveTimeline(opts: {
  reincarnations: number
  year: number
  age: number
  totalYears: number
  lastLifeEndYear: number
}): string {
  const rei = Math.max(0, opts.reincarnations)
  const total = opts.totalYears + opts.age
  if (rei <= 0) {
    return `尚未转生 · 当前第${opts.year}年（首次修行，年号连续）· 寿龄 ${opts.age}`
  }
  return [
    `已转生 ${rei} 次`,
    `本世第${opts.year}年（转生后年号从第 1 年重新起算，不沿用上一世）`,
    `本世寿龄 ${opts.age}`,
    `历代累计寿龄约 ${total}`,
    opts.lastLifeEndYear > 0 ? `上一世结束于第${opts.lastLifeEndYear}年` : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

/** 创建新角色时的道痕修正气血 */
export function applyDaoToMaxHp(baseHp: number, daoMarks: number): number {
  const mul = 1 + Math.min(0.25, daoMarks * 0.002)
  return Math.floor(baseHp * mul)
}
