import { bumpTask, freshDailyState, realDayKey, type DailyVariant } from '../../game/daily'
import { isAscended } from '../../game/reincarnate'
import type { MetaGet, MetaSet } from '../gameState'

/**
 * 惰性刷新：跨现实日（或首次）重掷当日日课；飞升后只保留洞府类任务。
 * 注意必须用现实日而非游戏日：打坐/历练/炼丹等动作本身会推进游戏日，
 * 若按游戏日刷新，每次动作都会重掷日课并清空进度，多次数任务永不可完成。
 * 功行 points 跨日保留：全清累计 7 次换七日之赐，领取时再扣减。
 */
export function ensureDailyState(get: MetaGet, set: MetaSet) {
  const s = get()
  if (!s.player) return
  const key = realDayKey()
  if (s.daily && s.daily.dayKey === key) return
  const variant: DailyVariant = isAscended(s.player) ? 'ascended' : 'mortal'
  const points = s.daily?.points ?? 0
  set({ daily: { ...freshDailyState(key, variant), points } })
}

/**
 * v1.4 日课进度埋点：不在今日列表/已领取/已达标的任务自动忽略。
 * 各领域 action（打坐/历练/委托/炼丹/收获/喂食）在成功结算后调用。
 */
export function bumpDaily(get: MetaGet, set: MetaSet, taskId: string, n = 1) {
  ensureDailyState(get, set)
  const d = get().daily
  if (!d) return
  const task = d.tasks.find((t) => t.id === taskId)
  if (!task || task.claimed) return
  const tasks = bumpTask(d.tasks, taskId, n)
  const done = tasks.find((t) => t.id === taskId)
  if (done && done.progress === task.progress) return // 无实际推进（已达标）
  set({ daily: { ...d, tasks } })
}
