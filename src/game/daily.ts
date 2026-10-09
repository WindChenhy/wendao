import { DAILY_PICK_COUNT, DAILY_TASKS, DAILY_TASK_MAP, type DailyTaskDef } from '../data/daily'
import type { DailyState, DailyTaskState } from '../types'

/** 飞升后打坐/历练/委托已不可用，日课池只保留洞府类任务 */
const ASCENDED_TASK_IDS = ['craft', 'harvest', 'feed']

export type DailyVariant = 'mortal' | 'ascended'

function shuffle<T>(list: T[], rnd: () => number): T[] {
  const arr = [...list]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/** 掷出当日 3 条日课（当日不重复） */
export function rollDailyTasks(variant: DailyVariant, rnd: () => number = Math.random): DailyTaskState[] {
  const pool: DailyTaskDef[] =
    variant === 'ascended' ? DAILY_TASKS.filter((t) => ASCENDED_TASK_IDS.includes(t.id)) : DAILY_TASKS
  return shuffle(pool, rnd)
    .slice(0, Math.min(DAILY_PICK_COUNT, pool.length))
    .map((t) => ({ id: t.id, progress: 0, claimed: false }))
}

export function freshDailyState(dayKey: string, variant: DailyVariant): DailyState {
  return { dayKey, tasks: rollDailyTasks(variant), points: 0 }
}

/** 推进某条日课进度；已领取或已达标的不动 */
export function bumpTask(tasks: DailyTaskState[], id: string, n = 1): DailyTaskState[] {
  return tasks.map((t) => {
    if (t.id !== id || t.claimed) return t
    const target = DAILY_TASK_MAP[t.id]?.target ?? 1
    if (t.progress >= target) return t
    return { ...t, progress: Math.min(target, t.progress + n) }
  })
}

/** 全部任务均已领取 */
export function dailyAllClaimed(tasks: DailyTaskState[]): boolean {
  return tasks.length > 0 && tasks.every((t) => t.claimed)
}

/** 现实日 key（本地时区 YYYY-MM-DD） */
export function realDayKey(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function dateDiffDays(a: string, b: string): number {
  const ta = Date.parse(`${a}T00:00:00`)
  const tb = Date.parse(`${b}T00:00:00`)
  if (Number.isNaN(ta) || Number.isNaN(tb)) return Number.NaN
  return Math.round((tb - ta) / 86400000)
}

export interface CheckinOutcome {
  /** 本轮第几日（1–7） */
  day: number
  /** 连续签到总天数（断签重置为 1） */
  streak: number
}

/**
 * 计算签到结果：今天已签返回 null；与上次签到相差 1 日则连签 +1，否则断签回 1。
 * 7 日一轮循环发放 CHECKIN_REWARDS。
 */
export function checkinOutcome(
  lastDate: string,
  streak: number,
  today: string,
): CheckinOutcome | null {
  if (lastDate === today) return null
  const diff = dateDiffDays(lastDate, today)
  const nextStreak = diff === 1 ? Math.max(0, streak) + 1 : 1
  return { day: ((nextStreak - 1) % 7) + 1, streak: nextStreak }
}
