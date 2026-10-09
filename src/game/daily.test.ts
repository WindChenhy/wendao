import { describe, expect, it } from 'vitest'
import {
  CHECKIN_REWARDS,
  DAILY_TASKS,
  dailyExpReward,
  dailyStoneReward,
  pillForRealm,
} from '../data/daily'
import {
  bumpTask,
  checkinOutcome,
  dailyAllClaimed,
  freshDailyState,
  realDayKey,
  rollDailyTasks,
} from './daily'

const seqRnd = () => 0.42 // 固定随机：洗牌确定

describe('rollDailyTasks', () => {
  it('凡世掷 3 条且不重复、均在任务池内', () => {
    const tasks = rollDailyTasks('mortal', seqRnd)
    expect(tasks).toHaveLength(3)
    const ids = tasks.map((t) => t.id)
    expect(new Set(ids).size).toBe(3)
    for (const id of ids) expect(DAILY_TASKS.some((d) => d.id === id)).toBe(true)
    for (const t of tasks) {
      expect(t.progress).toBe(0)
      expect(t.claimed).toBe(false)
    }
  })

  it('飞升后只掷洞府类任务（craft/harvest/feed）', () => {
    for (let i = 0; i < 20; i++) {
      const tasks = rollDailyTasks('ascended', Math.random)
      expect(tasks.length).toBeGreaterThan(0)
      for (const t of tasks) expect(['craft', 'harvest', 'feed']).toContain(t.id)
    }
  })

  it('freshDailyState 携带当日 key 与零积分', () => {
    const st = freshDailyState('第2年3月4日', 'mortal')
    expect(st.dayKey).toBe('第2年3月4日')
    expect(st.points).toBe(0)
    expect(st.tasks).toHaveLength(3)
  })
})

describe('bumpTask', () => {
  it('推进进度且封顶于目标数', () => {
    const tasks = rollDailyTasks('mortal', seqRnd)
    const id = tasks[0].id
    const def = DAILY_TASKS.find((d) => d.id === id)!
    const bumped = bumpTask(tasks, id, def.target + 5)
    expect(bumped.find((t) => t.id === id)!.progress).toBe(def.target)
    // 其余任务不受影响
    for (const t of bumped) if (t.id !== id) expect(t.progress).toBe(0)
  })

  it('已领取的任务不再推进', () => {
    const tasks = rollDailyTasks('mortal', seqRnd).map((t) => ({ ...t, claimed: true }))
    const id = tasks[0].id
    expect(bumpTask(tasks, id, 1).find((t) => t.id === id)!.progress).toBe(0)
  })
})

describe('dailyAllClaimed', () => {
  it('全部领取才返回 true', () => {
    expect(dailyAllClaimed([])).toBe(false)
    const tasks = rollDailyTasks('mortal', seqRnd).map((t) => ({ ...t, claimed: true }))
    expect(dailyAllClaimed(tasks)).toBe(true)
    const partial = rollDailyTasks('mortal', seqRnd)
    partial[0].claimed = true
    expect(dailyAllClaimed(partial)).toBe(false)
  })
})

describe('checkinOutcome', () => {
  it('同日重复签到返回 null', () => {
    expect(checkinOutcome('2026-10-09', 3, '2026-10-09')).toBeNull()
  })

  it('连续签到 streak +1、轮转 7 日', () => {
    expect(checkinOutcome('2026-10-08', 6, '2026-10-09')).toEqual({ day: 7, streak: 7 })
    expect(checkinOutcome('2026-10-09', 7, '2026-10-10')).toEqual({ day: 1, streak: 8 })
  })

  it('断签重置为 1', () => {
    expect(checkinOutcome('2026-10-05', 9, '2026-10-09')).toEqual({ day: 1, streak: 1 })
  })

  it('从未签到从第 1 天开始', () => {
    expect(checkinOutcome('', 0, '2026-10-09')).toEqual({ day: 1, streak: 1 })
  })

  it('跨月连续日期正确判定', () => {
    expect(checkinOutcome('2026-09-30', 2, '2026-10-01')).toEqual({ day: 3, streak: 3 })
  })
})

describe('奖励公式', () => {
  it('dailyExpReward 练气保底 30、飞升为 0', () => {
    expect(dailyExpReward('qi', 1)).toBe(30)
    expect(dailyExpReward('ascended', 1)).toBe(0)
  })

  it('dailyExpReward 随层数需求缩放（大乘显著高于练气）', () => {
    expect(dailyExpReward('mahayana', 1)).toBeGreaterThan(1000)
  })

  it('dailyStoneReward 在 20–50 区间', () => {
    expect(dailyStoneReward(() => 0)).toBe(20)
    expect(dailyStoneReward(() => 0.999)).toBe(50)
  })

  it('pillForRealm 练气给品阶丹、飞升为 null', () => {
    const pillId = pillForRealm('qi')
    expect(pillId).toBeTruthy()
    expect(pillId).toMatch(/^pill_/)
    expect(pillForRealm('ascended')).toBeNull()
  })
})

describe('签到表与真实日期', () => {
  it('签到表覆盖 1–7 日', () => {
    expect(CHECKIN_REWARDS.map((r) => r.day).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it('realDayKey 为 YYYY-MM-DD', () => {
    expect(realDayKey(new Date(2026, 9, 9))).toBe('2026-10-09')
    expect(realDayKey(new Date(2026, 0, 3))).toBe('2026-01-03')
  })
})
