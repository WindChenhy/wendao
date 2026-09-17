import { CLASSES } from '../data/classes'
import { realmIndex } from '../data/realms'
import type { ClassId, GameTime, RealmId } from '../types'

export function dayKey(t: GameTime): string {
  return `第${t.year}年${t.month}月${t.day}日`
}

/** 绝对日序（1年=12月，1月=30日） */
export function dayNumber(t: GameTime): number {
  return (Math.max(1, t.year) - 1) * 360 + (Math.max(1, t.month) - 1) * 30 + (Math.max(1, t.day) - 1)
}

function nextDay(t: GameTime): { time: GameTime; agedYears: number } {
  let { year, month, day } = t
  day += 1
  if (day > 30) {
    day = 1
    month += 1
  }
  if (month > 12) {
    month = 1
    year += 1
    return { time: { year, month, day }, agedYears: 1 }
  }
  return { time: { year, month, day }, agedYears: 0 }
}

export function advanceTime(t: GameTime, days: number): { time: GameTime; agedYears: number } {
  let time = { ...t }
  let agedYears = 0
  for (let i = 0; i < days; i++) {
    const r = nextDay(time)
    time = r.time
    agedYears += r.agedYears
  }
  return { time, agedYears }
}

/**
 * 一日打坐修为。
 * 收益随境界缓慢上升，但远慢于 expNeeded 的指数抬升 —— 后期突破更难。
 */
export function cultivateGain(classId: ClassId, realm: RealmId, layer: number): number {
  const rate = CLASSES[classId].cultivateRate
  const ri = Math.max(0, realmIndex(realm))
  const base = 12 * Math.pow(1.32, ri) * (1 + (layer - 1) * 0.18)
  const variance = 0.85 + Math.random() * 0.3
  return Math.max(3, Math.floor(base * rate * variance))
}

/** 闭关多日总收益（略低效率换时间） */
export function seclusionGain(classId: ClassId, realm: RealmId, layer: number, days: number): number {
  let total = 0
  for (let i = 0; i < days; i++) {
    total += cultivateGain(classId, realm, layer)
  }
  return Math.floor(total * 0.92)
}

/** 恢复每日气血/灵力 */
export function dailyRecover(maxHp: number, maxEnergy: number): { hp: number; energy: number } {
  return {
    hp: Math.floor(maxHp * 0.12) + 8,
    energy: Math.floor(maxEnergy * 0.2) + 10,
  }
}

export function weatherOf(t: GameTime): string {
  const list = ['晴', '多云', '细雨', '雷雨', '大风', '薄雾']
  const seed = (t.year * 372 + t.month * 31 + t.day) % list.length
  return list[seed]
}

/** 高境界可选闭关年数 */
export function seclusionYearOptions(realm: RealmId): number[] {
  const ri = realmIndex(realm)
  if (ri >= 5) return [7, 30, 180, 365]
  if (ri >= 2) return [7, 30, 90]
  return [7, 30]
}