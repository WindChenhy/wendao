import { describe, expect, it } from 'vitest'
import { CLASSES } from '../data/classes'
import { breakthroughSuccessRate } from './rules/breakthrough'
import {
  BREAKTHROUGH_FAIL_HEART_DEMON,
  CLEANSE_PILL_HEART_DEMON,
  FORBIDDEN_PATH_HEART_DEMON,
  HEART_DEMON_MAX,
  HEART_DEMON_TRIBULATION_THRESHOLD,
  adjustHeartDemon,
  clampHeartDemon,
  heartDemonBreakthroughPenalty,
  heartDemonTribulation,
} from './heartDemon'
import { enshrinePath } from './paths'
import { deriveAlignment, resolveAlignment } from './reputation'
import type { PlayerState } from '../types'

function basePlayer(over: Partial<PlayerState> = {}): PlayerState {
  return {
    name: '测',
    gender: 'male',
    classId: 'none',
    paths: [],
    realm: 'golden_core',
    layer: 1,
    exp: 0,
    hp: 100,
    maxHp: 100,
    energy: 50,
    maxEnergy: 50,
    shaqi: 0,
    age: 16,
    lifespanLeft: 400,
    repRight: 5,
    repDemonic: 0,
    alive: true,
    ascended: false,
    ...over,
  }
}

describe('R-24 心魔值', () => {
  it('夹取到 0–100，非有限值归零', () => {
    expect(clampHeartDemon(-5)).toBe(0)
    expect(clampHeartDemon(150)).toBe(HEART_DEMON_MAX)
    expect(clampHeartDemon(NaN)).toBe(0)
    expect(adjustHeartDemon(95, 20)).toBe(100)
    expect(adjustHeartDemon(undefined, -10)).toBe(0)
  })

  it('突破压制：每 10 点心魔 −1% 成功率', () => {
    expect(heartDemonBreakthroughPenalty(0)).toBe(0)
    expect(heartDemonBreakthroughPenalty(9)).toBe(0)
    expect(heartDemonBreakthroughPenalty(25)).toBe(2)
    expect(heartDemonBreakthroughPenalty(100)).toBe(10)
    // 与突破规则打通：同一境界下，心魔越高最终率越低（且不击穿 5% 下限）
    const args = { classId: 'sword' as const, realm: 'foundation' as const, layer: 1 }
    const clean = breakthroughSuccessRate({ ...args, heartDemon: 0 })
    const hd20 = breakthroughSuccessRate({ ...args, heartDemon: 20 })
    const hd100 = breakthroughSuccessRate({ ...args, heartDemon: 100 })
    expect(hd20).toBeLessThan(clean)
    expect(hd100).toBeLessThan(hd20)
    expect(hd100).toBeGreaterThanOrEqual(5)
  })

  it('心魔 ≥60 引动心魔劫，削减常量与规格一致', () => {
    expect(heartDemonTribulation(59)).toBe(false)
    expect(heartDemonTribulation(HEART_DEMON_TRIBULATION_THRESHOLD)).toBe(true)
    expect(BREAKTHROUGH_FAIL_HEART_DEMON).toBe(5)
    expect(CLEANSE_PILL_HEART_DEMON).toBe(15)
    expect(FORBIDDEN_PATH_HEART_DEMON).toBe(20)
  })

  it('立禁忌道途即种心魔 +20、显式堕入魔立场；普通道途不种心魔', () => {
    const soul = enshrinePath(basePlayer(), CLASSES.soul)
    expect(soul.player.heartDemon).toBe(20)
    expect(soul.player.alignment).toBeUndefined() // 魂道是中立禁忌，不改立场

    const demon = enshrinePath(basePlayer({ repRight: 50 }), CLASSES.demon)
    expect(demon.player.heartDemon).toBe(20)
    expect(demon.player.alignment).toBe('demonic')
    expect(demon.player.repRight).toBe(10) // 血誓 −40

    const sword = enshrinePath(basePlayer(), CLASSES.sword)
    expect(sword.player.heartDemon ?? 0).toBe(0)
  })

  it('心魔累积夹取：连立魂/魔两道至多 100', () => {
    const first = enshrinePath(basePlayer({ heartDemon: 90 }), CLASSES.soul)
    expect(first.player.heartDemon).toBe(100)
  })
})

describe('R-31 立场独立推导', () => {
  it('双声望推导：过线且压过另一方才定立场，否则中立', () => {
    expect(deriveAlignment(5, 0)).toBe('neutral')
    expect(deriveAlignment(100, 0)).toBe('righteous')
    expect(deriveAlignment(0, 100)).toBe('demonic')
    expect(deriveAlignment(30, 20)).toBe('righteous')
    expect(deriveAlignment(20, 30)).toBe('demonic')
    // 两边皆盛：谁压过谁
    expect(deriveAlignment(120, 100)).toBe('righteous')
  })

  it('resolveAlignment：显式立场优先，兼容旧档（无字段则推导）', () => {
    expect(resolveAlignment({ alignment: 'neutral', repRight: 0, repDemonic: 200 })).toBe('neutral')
    expect(resolveAlignment({ repRight: 0, repDemonic: 50 })).toBe('demonic')
    expect(resolveAlignment(null)).toBe('neutral')
  })

  it('剑修行凶亦可堕魔：isDemonic 认立场，洗魔归正后不再因立场成魔（道途本身另算）', () => {
    // 动态导入避免循环顾虑
    return import('../data/classes').then(({ isDemonic }) => {
      expect(isDemonic({ classId: 'sword', repRight: -35, repDemonic: 40 })).toBe(true)
      expect(isDemonic({ classId: 'sword', alignment: 'demonic' })).toBe(true)
      // 洗魔后：剑道 + 中立立场
      expect(isDemonic({ classId: 'sword', alignment: 'neutral', repRight: 60, repDemonic: 0 })).toBe(false)
      // 魔道本身仍算魔修
      expect(isDemonic({ classId: 'demon', alignment: 'neutral' })).toBe(true)
    })
  })
})
