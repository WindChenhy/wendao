import { describe, expect, it } from 'vitest'
import {
  calcOfflineCultivation,
  OFFLINE_HOUR_CAP,
  OFFLINE_MIN_MS,
  OFFLINE_PILL_BONUS,
  OFFLINE_PILL_IDS,
  OFFLINE_STONE_BONUS,
  type OfflineSettlement,
} from './offline'
import { ITEMS } from '../data/items'
import { CLASSES } from '../data/classes'
import { realmIndex } from '../data/realms'
import type { ClassId, RealmId } from '../types'

const HOUR = 3600000

/** 手算对照：12 × 1.32^ri × (1+(layer-1)×0.18) × rate × multipliers × 0.85，向下取整且不低于 3 */
function manualExpPerHour(classId: ClassId, realm: RealmId, layer: number, multipliers = 1): number {
  const rate = CLASSES[classId].cultivateRate
  const base = 12 * Math.pow(1.32, realmIndex(realm)) * (1 + (layer - 1) * 0.18)
  return Math.max(3, Math.floor(base * rate * multipliers * 0.85))
}

const NOW = 1_800_000_000_000

function settle(over: Partial<Parameters<typeof calcOfflineCultivation>[0]> = {}): OfflineSettlement {
  return calcOfflineCultivation({
    lastOnlineAt: NOW - 10 * HOUR,
    now: NOW,
    classId: 'alchemy',
    realm: 'qi',
    layer: 1,
    multipliers: 1,
    ...over,
  })
}

describe('离线结算 calcOfflineCultivation', () => {
  it('时长不足 OFFLINE_MIN_MS → too_short 且不结算', () => {
    const r = settle({ lastOnlineAt: NOW - (OFFLINE_MIN_MS - 60_000) })
    expect(r.active).toBe(false)
    expect(r.reason).toBe('too_short')
    expect(r.expGain).toBe(0)
    expect(r.deepenStoneCost).toBe(0)
  })

  it('lastOnlineAt 非法（0/NaN）→ too_short', () => {
    expect(settle({ lastOnlineAt: 0 }).reason).toBe('too_short')
    expect(settle({ lastOnlineAt: Number.NaN }).reason).toBe('too_short')
  })

  it('时钟回拨（lastOnlineAt 在未来）→ clock_backward', () => {
    const r = settle({ lastOnlineAt: NOW + HOUR })
    expect(r.active).toBe(false)
    expect(r.reason).toBe('clock_backward')
  })

  it('恰好达到下限（5 分钟）即结算', () => {
    const r = settle({ lastOnlineAt: NOW - OFFLINE_MIN_MS })
    expect(r.active).toBe(true)
    expect(r.reason).toBe('ok')
  })

  it('qi 境 8 小时封顶：hoursCounted 受 OFFLINE_HOUR_CAP 限制', () => {
    const r = settle({ lastOnlineAt: NOW - 100 * HOUR })
    expect(r.capHours).toBe(OFFLINE_HOUR_CAP.qi)
    expect(r.capHours).toBe(8)
    expect(r.hoursRaw).toBeCloseTo(100)
    expect(r.hoursCounted).toBe(8)
  })

  it('expGain = expPerHour × hoursCounted（取整）', () => {
    const r = settle({ lastOnlineAt: NOW - 100 * HOUR })
    expect(r.expGain).toBe(Math.floor(r.expPerHour * r.hoursCounted))
    expect(r.expGain).toBe(80) // 修为/时 = floor(12 × 1 × 1 × 0.85) = 10 → 10 × 8
  })

  it('expPerHour 与打坐公式一致（手算对照）', () => {
    expect(settle({ classId: 'alchemy', realm: 'qi', layer: 1 }).expPerHour).toBe(
      manualExpPerHour('alchemy', 'qi', 1),
    )
    // 剑修 × 1.05，二层 × 1.18：12 × 1.18 × 1.05 × 0.85 = 12.6378 → 12
    expect(settle({ classId: 'sword', realm: 'qi', layer: 2 }).expPerHour).toBe(12)
    // 金丹三层：12 × 1.32² × 1.36 × 0.85 = 24.17 → 24
    expect(settle({ classId: 'alchemy', realm: 'golden_core', layer: 3 }).expPerHour).toBe(24)
    expect(settle({ classId: 'soul', realm: 'nascent_soul', layer: 2, multipliers: 1.2 }).expPerHour).toBe(
      manualExpPerHour('soul', 'nascent_soul', 2, 1.2),
    )
  })

  it('加深灵石：deepenStoneCost 按 (20+ri×15)/小时 且最低 20；加深收益按 BONUS 比例', () => {
    // 练气 10 小时 → 按 8 小时计：ceil(8 × 20) = 160
    const qi = settle({ lastOnlineAt: NOW - 10 * HOUR })
    expect(qi.deepenStoneCost).toBe(160)
    expect(qi.deepenStoneExp).toBe(Math.floor(qi.expGain * OFFLINE_STONE_BONUS))
    expect(qi.deepenPillExp).toBe(Math.floor(qi.expGain * OFFLINE_PILL_BONUS))
    expect(qi.deepenStoneExp).toBe(Math.floor(qi.expGain * 0.5))
    expect(qi.deepenPillExp).toBe(Math.floor(qi.expGain * 0.25))

    // 金丹（ri=2）5 小时 → ceil(5 × 50) = 250
    const gc = settle({ realm: 'golden_core', lastOnlineAt: NOW - 5 * HOUR })
    expect(gc.hoursCounted).toBeCloseTo(5)
    expect(gc.deepenStoneCost).toBe(250)
  })

  it('短时长的结算值随时长线性，且丹药加深不依赖背包（由商店层处理）', () => {
    const r = settle({ lastOnlineAt: NOW - 3 * HOUR })
    expect(r.hoursCounted).toBeCloseTo(3)
    expect(r.expGain).toBe(Math.floor(10 * 3))
    expect(r.deepenPillExp).toBe(Math.floor(r.expGain * OFFLINE_PILL_BONUS))
  })
})

describe('OFFLINE_PILL_IDS 数据派生', () => {
  it('包含旧白名单 4 id，且相对优先级不变（pill_qi 最先）', () => {
    for (const id of ['pill_qi', 'pill_great', 'snake_gall', 'fox_core']) {
      expect(OFFLINE_PILL_IDS).toContain(id)
    }
    expect(OFFLINE_PILL_IDS.indexOf('pill_qi')).toBeLessThan(OFFLINE_PILL_IDS.indexOf('pill_great'))
    expect(OFFLINE_PILL_IDS.indexOf('pill_great')).toBeLessThan(OFFLINE_PILL_IDS.indexOf('snake_gall'))
    expect(OFFLINE_PILL_IDS.indexOf('snake_gall')).toBeLessThan(OFFLINE_PILL_IDS.indexOf('fox_core'))
  })

  it('派生规则 = pill_* 且 exp>0，另保留旧妖材 snake_gall/fox_core', () => {
    const expected = Object.keys(ITEMS).filter(
      (id) =>
        (ITEMS[id]?.effect?.exp ?? 0) > 0 &&
        (id.startsWith('pill_') || id === 'snake_gall' || id === 'fox_core'),
    )
    expect(OFFLINE_PILL_IDS).toEqual(expected)
  })

  it('v1.3 高阶 exp 丹药自动入围；无 exp 丹药与炼丹材料不入围', () => {
    for (const id of ['pill_core', 'pill_soul', 'pill_god', 'pill_void', 'pill_join', 'pill_maha', 'pill_xian']) {
      expect(OFFLINE_PILL_IDS, `${id} 应自动入围`).toContain(id)
    }
    expect(OFFLINE_PILL_IDS).not.toContain('pill_heal')
    expect(OFFLINE_PILL_IDS).not.toContain('pill_break')
    expect(OFFLINE_PILL_IDS).not.toContain('demon_shard')
    expect(OFFLINE_PILL_IDS).not.toContain('herb_cloud')
  })
})
