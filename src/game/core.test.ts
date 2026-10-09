import { describe, expect, it } from 'vitest'
import { danMarkMul, itemEffectWithMarks, itemMinRealmOk, itemOverScope } from '../data/items'
import { gongfaGradesAllowed, gongfaInScope, gongfaScopeText } from '../data/gongfa'
import { activeSynergies, synergyBonus } from '../data/gongfaSynergy'
import { gongfaBonuses, treasureBonus } from './combatStats'
import { storyEndingKey } from '../data/companions'
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
  it('功法加成与羁绊', () => {
    const b = gongfaBonuses({ gf_jifeng: { stage: 0 }, gf_liedi: { stage: 0 }, gf_bengshan: { stage: 0 } })
    expect(b.atk).toBeGreaterThan(1)
    expect(b.synergies.length).toBeGreaterThan(0)
  })
  it('treasureBonus 基础叠加', () => {
    const t = treasureBonus(['treasure_sword'])
    expect(t.atk).toBeGreaterThan(1)
  })
  it('treasureBonus 聚合 cultivate/dodge（无法宝时中性值）', () => {
    const none = treasureBonus([])
    expect(none.cultivate).toBe(1)
    expect(none.dodge).toBe(0)
    const t = treasureBonus(['treasure_lotus', 'treasure_qin'])
    expect(t.cultivate).toBeCloseTo(1.12 * 1.15) // lotus 0.12 × qin 0.15
    expect(t.dodge).toBeCloseTo(0.04) // qin 0.04（加算）
    expect(treasureBonus(['treasure_dao_lotus']).cultivate).toBeCloseTo(1.18)
  })
  it('synergy 空列表不报错', () => {
    expect(synergyBonus([]).atk).toBe(0)
    expect(activeSynergies([]).length).toBe(0)
  })
})

describe('道侣结局键', () => {
  it('storyEndingKey 拼接角色与结局', () => {
    expect(storyEndingKey('lin_wan', 'he')).toBe('lin_wan_he')
  })
})
