import dailyDb from './db/daily_tasks.json'
import { ITEMS } from './items'
import { expNeeded, realmIndex } from './realms'
import type { RealmId } from '../types'

/** v1.4 日课任务定义（数值见 db/daily_tasks.json） */
export interface DailyTaskDef {
  id: string
  desc: string
  target: number
}

/** v1.4 签到单日奖励定义 */
export interface CheckinRewardDef {
  day: number
  stones?: number
  /** 按当前层修为需求的比例给修为 */
  expPctOfNeed?: number
  itemId?: string
  count?: number
  /** true 时按大境界随机发 1 颗对应品阶丹药 */
  pillGradePick?: boolean
}

export const DAILY_TASKS: DailyTaskDef[] = dailyDb.tasks as DailyTaskDef[]
export const DAILY_TASK_MAP: Record<string, DailyTaskDef> = Object.fromEntries(
  DAILY_TASKS.map((t) => [t.id, t]),
)
export const DAILY_PICK_COUNT: number = dailyDb.pickCount
export const DAILY_REWARD: {
  stoneMin: number
  stoneMax: number
  expPctOfNeed: number
  expMin: number
} = dailyDb.reward
export const DAILY_ALL_CLEAR_STONE_MUL: number = dailyDb.allClearBonusStoneMul
export const WEEK_GIFT: { points: number; stones: number; expPctOfNeed: number } = dailyDb.weekGift
export const CHECKIN_REWARDS: CheckinRewardDef[] = dailyDb.checkin as CheckinRewardDef[]

/** 日课/签到修为奖励：按当前层修为需求比例缩放，练气保底 30；飞升后修为无意义返回 0 */
export function dailyExpReward(realm: RealmId, layer: number, pct = DAILY_REWARD.expPctOfNeed): number {
  const need = expNeeded(realm, layer)
  if (need <= 0) return 0
  return Math.max(DAILY_REWARD.expMin, Math.floor(need * pct))
}

/** 日课单条灵石奖励（20～50 随机） */
export function dailyStoneReward(rnd: () => number = Math.random): number {
  const span = DAILY_REWARD.stoneMax - DAILY_REWARD.stoneMin
  return DAILY_REWARD.stoneMin + Math.floor(rnd() * (span + 1))
}

/** 按大境界随机挑 1 颗对应品阶的可服用丹药（pillGrade 1–9 对应十大境界；无则 null） */
export function pillForRealm(realm: RealmId): string | null {
  const grade = realmIndex(realm) + 1
  if (grade > 9) return null
  const pool = Object.values(ITEMS).filter(
    (it) => it.type === 'consumable' && it.pillGrade === grade,
  )
  if (pool.length === 0) return null
  return pool[Math.floor(Math.random() * pool.length)].id
}
