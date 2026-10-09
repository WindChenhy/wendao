import { describe, expect, it, vi, type MockInstance } from 'vitest'
import {
  advanceTime,
  cultivateGain,
  dailyRecover,
  dayKey,
  dayNumber,
  GAME_DAYS_PER_YEAR,
  seclusionGain,
} from './day'
import type { ClassId, GameTime } from '../types'

describe('游戏日历', () => {
  it('dayNumber 跨月/跨年线性递增（1年=12月×30日）', () => {
    expect(dayNumber({ year: 1, month: 1, day: 1 })).toBe(0)
    expect(dayNumber({ year: 1, month: 2, day: 1 })).toBe(30)
    expect(dayNumber({ year: 1, month: 12, day: 30 })).toBe(359)
    expect(dayNumber({ year: 2, month: 1, day: 1 })).toBe(360)
    expect(dayNumber({ year: 2, month: 2, day: 1 })).toBe(390)
    expect(dayNumber({ year: 3, month: 5, day: 15 })).toBe(2 * 360 + 4 * 30 + 14)
    expect(dayKey({ year: 2, month: 3, day: 4 })).toBe('第2年3月4日')
  })

  it('advanceTime(1) 月末 30 → 次月 1', () => {
    const r = advanceTime({ year: 1, month: 1, day: 30 }, 1)
    expect(r.time).toEqual({ year: 1, month: 2, day: 1 })
    expect(r.agedYears).toBe(0)
  })

  it('advanceTime(1) 12 月末跨年且 agedYears=1', () => {
    expect(advanceTime({ year: 1, month: 12, day: 30 }, 1).time).toEqual({ year: 2, month: 1, day: 1 })
    expect(advanceTime({ year: 1, month: 12, day: 30 }, 1).agedYears).toBe(1)
    expect(advanceTime({ year: 99, month: 12, day: 30 }, 1).time).toEqual({ year: 100, month: 1, day: 1 })
  })

  it('advanceTime(360) 恰好 +1 岁（一年=360 日）', () => {
    const start: GameTime = { year: 5, month: 3, day: 10 }
    const r = advanceTime(start, GAME_DAYS_PER_YEAR)
    expect(r.time).toEqual({ year: 6, month: 3, day: 10 })
    expect(r.agedYears).toBe(1)
    expect(dayNumber(r.time) - dayNumber(start)).toBe(360)
  })

  it('cultivateGain 正常境界返回 >0', () => {
    expect(cultivateGain('sword', 'qi', 1)).toBeGreaterThan(0)
    expect(cultivateGain('demon', 'nascent_soul', 5)).toBeGreaterThan(0)
  })

  it('传损坏 classId 不抛错且回退返回 >0（v1.3 ?? 1）', () => {
    expect(() => cultivateGain('bad_class' as ClassId, 'qi', 1)).not.toThrow()
    expect(cultivateGain('bad_class' as ClassId, 'qi', 1)).toBeGreaterThan(0)
  })

  it('dailyRecover 按比例恢复气血/灵力', () => {
    expect(dailyRecover(100, 50)).toEqual({ hp: 20, energy: 20 })
    expect(dailyRecover(0, 0)).toEqual({ hp: 8, energy: 10 })
    expect(dailyRecover(305, 47).hp).toBe(Math.floor(305 * 0.12) + 8)
  })

  it('seclusionGain(days) ≈ 逐日 cultivateGain 之和 × 0.92', () => {
    const spy = vi.spyOn(Math, 'random').mockReturnValue(0.5) as MockInstance<() => number>
    try {
      const days = 10
      let sum = 0
      for (let i = 0; i < days; i++) sum += cultivateGain('sword', 'qi', 1)
      expect(seclusionGain('sword', 'qi', 1, days)).toBe(Math.floor((sum * 0.92)))
      // 固定随机下方差为 1：每日 = floor(12 × 1.05) = 12 → floor(120 × 0.92) = 110
      expect(seclusionGain('sword', 'qi', 1, days)).toBe(110)
    } finally {
      spy.mockRestore()
    }
  })
})
