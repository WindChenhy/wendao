import { playerMults, type PathInput } from '../data/classes'
import { realmIndex } from '../data/realms'
import type { GameTime, RealmId } from '../types'

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
 * 传入道途集合（主修全额、兼修拖累）或单个道途 id；损坏存档回退到基础速率。
 * variance 为随机扰动（默认 0.85~1.15 均匀分布）；节奏测算/确定性测试可显式传 1（期望值）。
 */
export function cultivateGain(
  paths: PathInput,
  realm: RealmId,
  layer: number,
  variance: number = 0.85 + Math.random() * 0.3,
): number {
  const rate = playerMults(paths).cultivateRate
  const ri = Math.max(0, realmIndex(realm))
  // layer 下界夹取与 offline.ts 同口径，防 layer=0 时两处速率不一致
  const base = 12 * Math.pow(1.32, ri) * (1 + (Math.max(1, layer) - 1) * 0.18)
  return Math.max(3, Math.floor(base * rate * variance))
}

/** 闭关多日总收益（略低效率换时间） */
export function seclusionGain(paths: PathInput, realm: RealmId, layer: number, days: number): number {
  let total = 0
  for (let i = 0; i < days; i++) {
    total += cultivateGain(paths, realm, layer)
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
  // 复用 dayNumber（已做正数夹取），避免负年份/负数月日产生负索引取到 undefined
  const seed = dayNumber(t) % list.length
  return list[seed]
}

/** 游戏内一年 = 12 月 × 30 日；闭关「N 年」必须按此换算，避免 365 日被多算寿元 */
export const GAME_DAYS_PER_YEAR = 360

/**
 * 历练时长（一次性出门历练 N 日）：按境界解锁更长行程。
 * - 元婴及以上：一次一月（30 日）
 * - 练虚及以上：一次半年（180 日）
 * - 大乘及以上：一次一年（360 日）
 */
export interface ExploreSpan {
  days: number
  label: string
  /** 解锁所需最低境界 */
  minRealm: RealmId
}

export const EXPLORE_SPANS: ExploreSpan[] = [
  { days: 30, label: '一月（30 日）', minRealm: 'nascent_soul' },
  { days: 180, label: '半年（180 日）', minRealm: 'void' },
  { days: 360, label: '一年（360 日）', minRealm: 'mahayana' },
]

/** 一次历练最多结算多少场遭遇（其余时日算作赶路，避免超长行程卡顿） */
export const EXPLORE_MAX_FIGHTS = 60

/** 当前境界已解锁的历练时长（未解锁的不在此列，UI 另取整表用于置灰展示） */
export function exploreSpanOptions(realm: RealmId): ExploreSpan[] {
  const ri = realmIndex(realm)
  return EXPLORE_SPANS.filter((s) => ri >= realmIndex(s.minRealm))
}

/** 该时长是否已对当前境界解锁 */
export function exploreSpanUnlocked(realm: RealmId, days: number): boolean {
  const s = EXPLORE_SPANS.find((x) => x.days === days)
  if (!s) return false
  return realmIndex(realm) >= realmIndex(s.minRealm)
}

/** 高境界可选闭关时长（游戏日） */
export function seclusionYearOptions(realm: RealmId): number[] {
  const ri = realmIndex(realm)
  const y = GAME_DAYS_PER_YEAR
  // 大乘及以上：百年闭关
  if (ri >= realmIndex('mahayana')) return [180, y, y * 10, y * 100]
  // 炼虚及以上：隐藏 7 日 / 30 日，开放十年闭关
  if (ri >= realmIndex('void')) return [90, 180, y, y * 10]
  if (ri >= 2) return [7, 30, 90]
  return [7, 30]
}