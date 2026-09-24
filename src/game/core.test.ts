import { describe, expect, it } from 'vitest'
import { danMarkMul, itemEffectWithMarks, itemMinRealmOk, itemOverScope } from '../data/items'
import { gongfaGradesAllowed, gongfaInScope, gongfaScopeText } from '../data/gongfa'
import { activeSynergies, synergyBonus } from '../data/gongfaSynergy'
import { treasureBreakthroughTotal, gongfaBonuses, treasureBonus } from './combatStats'
import { softenSeverity, isTribulationMoment, tribulationPlan } from '../data/tribulation'
import { sealSlots, sealDaoCost } from './seal'
import { storyEndingKey } from '../data/companions'
import { TUNING } from './tuning'
import { remapFarmPlots, makeFarmGrid, freshAbode, migrateAbode } from './farm'
import { mergeCollection, migrateLegacy, migrateSect, uniqIds } from '../stores/saveMigrate'
import type { ItemDef } from '../types'

const pill: ItemDef = {
  id: 'pill_x',
  name: '测丹',
  type: 'consumable',
  desc: '',
  price: 10,
  danMarks: 2,
  minRealm: 'qi',
  maxRealm: 'golden_core',
  effect: { hp: 100, exp: 50 },
}

describe('丹纹与适用范围', () => {
  it('丹纹倍率 5 纹最佳', () => {
    expect(danMarkMul(0)).toBe(1)
    expect(danMarkMul(5)).toBeCloseTo(1.75)
    expect(itemEffectWithMarks(pill).hp).toBe(130)
  })
  it('起步境界与超范围衰减', () => {
    expect(itemMinRealmOk(pill, 'qi')).toBe(true)
    expect(itemOverScope(pill, 'qi')).toBe(false)
    expect(itemOverScope(pill, 'nascent_soul')).toBe(true)
    expect(TUNING.overScopeEfficiency).toBe(0.25)
  })
})

describe('功法品阶与适用', () => {
  it('大乘以上仅天阶', () => {
    expect(gongfaGradesAllowed('mahayana')).toEqual(['天阶'])
    expect(gongfaGradesAllowed('qi')).toContain('黄阶')
    expect(gongfaInScope({ id: 'a', name: 'a', grade: '黄阶', kind: '心法', desc: '', minRealm: 'qi', maxRealm: 'golden_core', price: 1, effect: {} }, 'qi')).toBe(true)
    expect(gongfaScopeText({ id: 'a', name: 'a', grade: '黄阶', kind: '心法', desc: '', minRealm: 'qi', maxRealm: 'golden_core', price: 1, effect: {} })).toContain('金丹')
  })
})

describe('战斗数值', () => {
  it('法宝突破含词条入口', () => {
    expect(treasureBreakthroughTotal([])).toBe(0)
    expect(treasureBreakthroughTotal(['treasure_compass'])).toBeGreaterThanOrEqual(8)
  })
  it('功法加成与羁绊', () => {
    const b = gongfaBonuses({ gf_jifeng: { stage: 0 }, gf_liedi: { stage: 0 }, gf_bengshan: { stage: 0 } })
    expect(b.atk).toBeGreaterThan(1)
    expect(b.synergies.length).toBeGreaterThan(0)
  })
  it('treasureBonus 基础叠加', () => {
    const t = treasureBonus(['treasure_sword'])
    expect(t.atk).toBeGreaterThan(1)
  })
  it('synergy 空列表不报错', () => {
    expect(synergyBonus([]).atk).toBe(0)
    expect(activeSynergies([]).length).toBe(0)
  })
})

describe('天劫与封印', () => {
  it('天劫时刻与降档', () => {
    expect(isTribulationMoment('qi', 1, 9)).toBe(false)
    expect(isTribulationMoment('qi', 9, 9)).toBe(true)
    expect(softenSeverity('critical')).toBe('major')
    expect(tribulationPlan('force').rateDelta).toBeLessThan(0)
  })
  it('封印槽与代价', () => {
    expect(sealSlots(0)).toBe(1)
    expect(sealSlots(360)).toBe(3)
    expect(sealDaoCost('treasure')).toBeGreaterThan(0)
    expect(storyEndingKey('lin_wan', 'he')).toBe('lin_wan_he')
  })
})

describe('灵田网格', () => {
  it('初始 36 格，最大 128', () => {
    const ab = freshAbode()
    expect(ab.plots.length).toBe(36)
    expect(makeFarmGrid(16, 8).length).toBe(128)
  })
  it('remap 保留种植', () => {
    const old = makeFarmGrid(2, 2)
    old[0] = { seedId: 'seed_qi', plantedDay: 1 }
    const next = remapFarmPlots(old, 2, 2, 3, 2)
    expect(next[0].seedId).toBe('seed_qi')
    expect(next.length).toBe(6)
  })
  it('migrateAbode 旧档补到 36', () => {
    const ab = migrateAbode({ plots: [{ seedId: null, plantedDay: 0 }] })
    expect(ab.plots.length).toBe(36)
  })
})

describe('存档迁移', () => {
  it('legacy 补 sealed 字段', () => {
    const l = migrateLegacy({ daoMarks: 10 })
    expect(l.sealed).toEqual([])
    expect(l.daoMarks).toBe(10)
  })
  it('sect 旧档补 quest/library', () => {
    const s = migrateSect({ sectId: 'qingyun', rank: 'menial', contribution: 5 })
    expect(s.quest).toBeNull()
    expect(s.libraryLv).toBe(0)
    expect(s.contribution).toBe(5)
  })
  it('mergeCollection 去重', () => {
    const m = mergeCollection(
      { realm: ['qi'], enemy: [], gongfa: [], item: [], companion: [], secret: [] },
      { realm: ['qi', 'foundation'] },
    )
    expect(m.realm).toEqual(['qi', 'foundation'])
    expect(uniqIds(['a', 'a', ''])).toEqual(['a'])
  })
})
