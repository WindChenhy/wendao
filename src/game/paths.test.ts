import { describe, expect, it } from 'vitest'
import {
  CLASSES,
  NO_PATH,
  SECONDARY_DRAG,
  hasPath,
  isDemonic,
  isPathDefined,
  pathEffectText,
  pathIdsOf,
  pathMults,
  pathSlotText,
  pathSummaryText,
  playerMults,
  primaryPathId,
  secondaryPathIds,
  secondarySlots,
} from '../data/classes'
import { APTITUDES } from '../data/aptitudes'
import { ORIGIN_LIST, ORIGINS, originOf } from '../data/origins'
import { PATH_LIST } from '../data/classes'
import type { ClassId, MetaStats, PathUnlock } from '../types'
import {
  PATH_STAT_LABELS,
  pathEnshrineText,
  pathUnlockStatus,
  primarySwitchCost,
  totalTowerFloors,
  type UnlockCtx,
} from './paths'

const zeroStats: MetaStats = {
  combatsWon: 0,
  combatsLost: 0,
  pillsCrafted: 0,
  artifactsForged: 0,
  stonesPeak: 0,
  offlineSettled: 0,
}

function ctxOf(over: Partial<UnlockCtx> = {}): UnlockCtx {
  return {
    realm: 'qi',
    layer: 1,
    stats: zeroStats,
    towerFloors: 0,
    repDemonic: 0,
    stones: 0,
    lifespanLeft: 100,
    ownedPaths: [],
    ...over,
  }
}

describe('道途集合归一化', () => {
  it('未择道时为空列表，主修为 none', () => {
    expect(pathIdsOf({ classId: 'none', paths: [] })).toEqual([])
    expect(primaryPathId({ classId: 'none', paths: [] })).toBe('none')
    expect(pathSummaryText({ classId: 'none', paths: [] })).toBe(NO_PATH.name)
  })

  it('对象 / 数组 / 字符串三种入参等价，且去重去 none', () => {
    expect(pathIdsOf({ classId: 'sword', paths: ['alchemy', 'sword'] })).toEqual(['sword', 'alchemy'])
    expect(pathIdsOf(['sword', 'none', 'alchemy'])).toEqual(['sword', 'alchemy'])
    expect(pathIdsOf('sword')).toEqual(['sword'])
    expect(pathIdsOf(null)).toEqual([])
  })

  it('旧档（只有 classId）等价于单一主修', () => {
    expect(pathIdsOf({ classId: 'demon' })).toEqual(['demon'])
    expect(hasPath({ classId: 'demon' }, 'demon')).toBe(true)
    expect(isDemonic({ classId: 'demon' })).toBe(true)
    expect(isDemonic({ classId: 'sword' })).toBe(false)
  })

  it('兼修列表与主修分离', () => {
    const p = { classId: 'sword' as ClassId, paths: ['alchemy' as ClassId, 'body' as ClassId] }
    expect(secondaryPathIds(p)).toEqual(['alchemy', 'body'])
    expect(pathSlotText(p, 'golden_core')).toBe('兼修位 2/2')
  })
})

describe('道途数值聚合', () => {
  it('未择道为全中性', () => {
    const m = pathMults({ classId: 'none', paths: [] })
    expect(m).toEqual({ cultivateRate: 1, breakthroughBonus: 0, atkMul: 1, defMul: 1, hpMul: 1 })
  })

  it('主修全额、兼修半数：剑道 + 兼修体道', () => {
    const m = pathMults({ classId: 'sword', paths: ['body'] })
    const sword = CLASSES.sword
    const body = CLASSES.body
    expect(m.cultivateRate).toBeCloseTo(sword.cultivateRate * (1 - SECONDARY_DRAG))
    expect(m.atkMul).toBeCloseTo(sword.atkMul * (1 + (body.atkMul - 1) * 0.5))
    expect(m.hpMul).toBeCloseTo(sword.hpMul * (1 + (body.hpMul - 1) * 0.5))
    expect(m.breakthroughBonus).toBeCloseTo(sword.breakthroughBonus + body.breakthroughBonus * 0.5)
  })

  it('每多一门兼修，修炼速度按 SECONDARY_DRAG 递减（分心拖慢）', () => {
    const one = pathMults({ classId: 'alchemy', paths: ['body'] }).cultivateRate
    const two = pathMults({ classId: 'alchemy', paths: ['body', 'sword'] }).cultivateRate
    expect(two).toBeLessThan(one)
    expect(two).toBeCloseTo(CLASSES.alchemy.cultivateRate * (1 - SECONDARY_DRAG * 2))
  })

  it('D-7：兼修硬惩罚保守版为每门 −2%（旧版 −5% 已废弃）', () => {
    expect(SECONDARY_DRAG).toBe(0.02)
  })

  it('拖累有下限（不会把修炼速度压到 0）', () => {
    const all = PATH_LIST.map((p) => p.id)
    const m = pathMults(all)
    expect(m.cultivateRate).toBeGreaterThan(0.5)
  })

  it('playerMults = 灵根 × 道途；杂灵根中性，天灵根更快但更脆', () => {
    const base = playerMults({ classId: 'sword', paths: [], aptitude: 'mixed' })
    expect(base.cultivateRate).toBeCloseTo(CLASSES.sword.cultivateRate)
    const heaven = playerMults({ classId: 'sword', paths: [], aptitude: 'heaven' })
    expect(heaven.cultivateRate).toBeGreaterThan(base.cultivateRate)
    expect(heaven.hpMul).toBeLessThan(base.hpMul)
    // 缺省 aptitude（旧档）等同杂灵根
    expect(playerMults({ classId: 'sword', paths: [] })).toEqual(base)
  })

  it('伪灵根以突破与根骨换修炼速度', () => {
    const f = APTITUDES.false
    const m = playerMults({ classId: 'none', paths: [], aptitude: 'false' })
    expect(m.cultivateRate).toBeLessThan(1)
    expect(m.breakthroughBonus).toBeGreaterThan(0)
    expect(m.hpMul).toBeGreaterThan(1)
    expect(f.tags.length).toBeGreaterThan(0)
  })
})

describe('兼修位随境界扩张', () => {
  it('练气无兼修位，筑基起逐境增加，上限 5', () => {
    expect(secondarySlots('qi')).toBe(0)
    expect(secondarySlots('foundation')).toBe(1)
    expect(secondarySlots('golden_core')).toBe(2)
    expect(secondarySlots('tribulation')).toBe(5)
  })
})

describe('问道立道条件', () => {
  it('条件不足时给出可读的缺失说明', () => {
    const sword = CLASSES.sword
    const st = pathUnlockStatus(sword, ctxOf())
    expect(st.ok).toBe(false)
    expect(st.owned).toBe(false)
    expect(st.missing.some((m) => m.includes('境界不足'))).toBe(true)
    expect(st.missing.some((m) => m.includes(PATH_STAT_LABELS.combatsWon))).toBe(true)
  })

  it('首立之道不占兼修位；已立满 5 门兼修后不再可立', () => {
    const met = ctxOf({
      realm: 'qi',
      layer: 9,
      stats: { ...zeroStats, combatsWon: 99, maxSwordIntent: 5 },
      stones: 0,
    })
    expect(pathUnlockStatus(CLASSES.sword, met).ok).toBe(true)

    const owned = PATH_LIST.slice(0, 2).map((p) => p.id)
    const st2 = pathUnlockStatus(CLASSES.alchemy, ctxOf({ ownedPaths: owned }))
    // 练气无兼修位：第二门即被兼修位拦下
    expect(st2.ok).toBe(false)
    expect(st2.missing.some((m) => m.includes('兼修位'))).toBe(true)
  })

  it('魔道需魔道声望，余下代价在 pathCost 中体现', () => {
    const demonOk = ctxOf({
      realm: 'qi',
      layer: 5,
      repDemonic: 30,
      stones: 0,
    })
    expect(pathUnlockStatus(CLASSES.demon, demonOk).ok).toBe(true)
    expect(pathUnlockStatus(CLASSES.demon, ctxOf({ realm: 'qi', layer: 5, repDemonic: 29 })).ok).toBe(false)
  })

  it('魂道需寿元足以支付代价', () => {
    const base = ctxOf({
      realm: 'golden_core',
      layer: 1,
      towerFloors: 18,
      lifespanLeft: 1,
    })
    const st = pathUnlockStatus(CLASSES.soul, base)
    expect(st.ok).toBe(false)
    expect(st.missing.some((m) => m.includes('寿元'))).toBe(true)
    expect(pathUnlockStatus(CLASSES.soul, { ...base, lifespanLeft: 50 }).ok).toBe(true)
  })

  it('已立此道返回 owned 且不可重复立道', () => {
    const st = pathUnlockStatus(CLASSES.sword, ctxOf({ ownedPaths: ['sword'] }))
    expect(st.owned).toBe(true)
    expect(st.ok).toBe(false)
    expect(st.missing).toContain('已立此道')
  })

  it('每条条件都带展示文案与达标标记', () => {
    const st = pathUnlockStatus(
      CLASSES.alchemy,
      ctxOf({ realm: 'qi', layer: 2, stats: { ...zeroStats, pillsCrafted: 8, bestDanMarks: 5 } }),
    )
    expect(st.ok).toBe(true)
    for (const r of st.reqs) {
      expect(r.text.length).toBeGreaterThan(0)
      expect(r.met).toBe(true)
    }
  })

  it('R-27：质变条件不满足时立道被拒（有次数无质量）', () => {
    // 剑道：胜场够但剑意未叠满
    const swordNo = ctxOf({
      realm: 'qi',
      layer: 9,
      stats: { ...zeroStats, combatsWon: 99, maxSwordIntent: 4 },
    })
    expect(pathUnlockStatus(CLASSES.sword, swordNo).ok).toBe(false)
    const swordMiss = pathUnlockStatus(CLASSES.sword, swordNo)
    expect(swordMiss.missing.some((m) => m.includes('剑意'))).toBe(true)

    // 丹道：炼够 8 炉但从未出五纹丹
    const alchemyNo = ctxOf({
      realm: 'qi',
      layer: 2,
      stats: { ...zeroStats, pillsCrafted: 99, bestDanMarks: 3 },
    })
    expect(pathUnlockStatus(CLASSES.alchemy, alchemyNo).ok).toBe(false)

    // 器道：打够 3 件但最高仅灵器（<宝器）
    const artifactNo = ctxOf({
      realm: 'qi',
      layer: 2,
      stats: { ...zeroStats, artifactsForged: 99, bestArtifactTier: 2 },
    })
    expect(pathUnlockStatus(CLASSES.artifact, artifactNo).ok).toBe(false)

    // 器道：曾炼出宝器（tier 3）即可
    const artifactOk = ctxOf({
      realm: 'qi',
      layer: 2,
      stats: { ...zeroStats, artifactsForged: 3, bestArtifactTier: 3 },
    })
    expect(pathUnlockStatus(CLASSES.artifact, artifactOk).ok).toBe(true)
  })
})

describe('道途辅助函数', () => {
  it('道途 id 判定与显示名', () => {
    expect(isPathDefined('sword')).toBe(true)
    expect(isPathDefined('none')).toBe(false)
    expect(pathSummaryText({ classId: 'sword', paths: ['body', 'soul'] })).toContain('兼修 2 门')
    expect(pathEffectText(CLASSES.sword)).toContain('攻击')
    expect(pathEffectText(CLASSES.body)).toContain('修炼')
    expect(pathEffectText(CLASSES.alchemy)).toContain('防御')
  })

  it('立道文案区分主修与兼修', () => {
    expect(pathEnshrineText(CLASSES.sword, true)).toContain('主修')
    expect(pathEnshrineText(CLASSES.sword, false)).toContain('兼修')
  })

  it('改立主修费用随境界上浮', () => {
    expect(primarySwitchCost('qi')).toBe(200)
    expect(primarySwitchCost('golden_core')).toBeGreaterThan(primarySwitchCost('qi'))
  })

  it('秘境累计通关层数求和', () => {
    expect(totalTowerFloors({ a: 4, b: 6 })).toBe(10)
  })

  it('道途数值字段齐备（防数据漏字段导致 NaN）', () => {
    for (const p of PATH_LIST) {
      const u: PathUnlock | undefined = p.unlock
      expect(Number.isFinite(p.cultivateRate)).toBe(true)
      expect(Number.isFinite(p.atkMul) && Number.isFinite(p.defMul) && Number.isFinite(p.hpMul)).toBe(true)
      expect(u?.note && u.note.length > 0).toBe(true)
    }
  })
})

describe('出身只影响起始盘缠与行囊', () => {
  it('出身表齐备且不含任何持久数值倍率', () => {
    expect(ORIGIN_LIST.length).toBeGreaterThanOrEqual(4)
    for (const o of ORIGIN_LIST) {
      expect(Object.keys(o)).not.toContain('cultivateRate')
      expect(o.startStones).toBeGreaterThanOrEqual(0)
    }
  })

  it('缺省出身可回退（旧档无 origin 字段）', () => {
    expect(originOf({})).toBe(ORIGINS.wild)
  })
})
