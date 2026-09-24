import { describe, expect, it } from 'vitest'
import { danMarkMul, itemEffectWithMarks, itemMinRealmOk, itemOverScope } from './items'
import { activeSynergies, synergyBonus } from './gongfaSynergy'
import { canLearnGongfaFull, gongfaInScope, gongfaGradesAllowed } from './gongfa'
import { TUNING } from '../game/tuning'
import type { ItemDef } from '../types'

describe('丹纹与适用范围', () => {
  it('丹纹倍率 5 纹为 1.75', () => {
    expect(danMarkMul(5)).toBeCloseTo(1 + 5 * TUNING.danMarkPerStack)
    expect(danMarkMul(0)).toBe(1)
    expect(danMarkMul(9)).toBeCloseTo(1 + 5 * TUNING.danMarkPerStack)
  })

  it('itemEffectWithMarks 按丹纹放大药效', () => {
    const pill: ItemDef = {
      id: 't',
      name: '测',
      type: 'consumable',
      desc: '',
      price: 1,
      danMarks: 2,
      effect: { hp: 100, exp: 50 },
    }
    const eff = itemEffectWithMarks(pill)
    expect(eff.hp).toBe(Math.floor(100 * danMarkMul(2)))
    expect(eff.exp).toBe(Math.floor(50 * danMarkMul(2)))
  })

  it('起步境界与适用范围', () => {
    const pill: ItemDef = {
      id: 't',
      name: '测',
      type: 'consumable',
      desc: '',
      price: 1,
      minRealm: 'foundation',
      maxRealm: 'golden_core',
    }
    expect(itemMinRealmOk(pill, 'qi')).toBe(false)
    expect(itemMinRealmOk(pill, 'foundation')).toBe(true)
    expect(itemOverScope(pill, 'golden_core')).toBe(false)
    expect(itemOverScope(pill, 'nascent_soul')).toBe(true)
  })
})

describe('功法品阶与适用范围', () => {
  it('大乘以上仅天阶', () => {
    expect(gongfaGradesAllowed('mahayana')).toEqual(['天阶'])
    expect(gongfaGradesAllowed('qi')).toContain('黄阶')
    expect(gongfaGradesAllowed('nascent_soul')).not.toContain('黄阶')
    expect(gongfaGradesAllowed('void')).not.toContain('玄阶')
  })

  it('超适用范围失效', () => {
    expect(gongfaInScope({ id: 'x', name: 'x', grade: '黄阶', kind: '心法', desc: '', minRealm: 'qi', maxRealm: 'golden_core', price: 1, effect: {} }, 'foundation')).toBe(true)
    expect(gongfaInScope({ id: 'x', name: 'x', grade: '黄阶', kind: '心法', desc: '', minRealm: 'qi', maxRealm: 'golden_core', price: 1, effect: {} }, 'nascent_soul')).toBe(false)
  })

  it('品阶门槛随境界收紧', () => {
    const yellow = { id: 'x', name: 'x', grade: '黄阶' as const, kind: '心法' as const, desc: '', minRealm: 'qi' as const, price: 1, effect: {} }
    expect(canLearnGongfaFull(yellow, 'qi')).toBe(true)
    expect(canLearnGongfaFull(yellow, 'nascent_soul')).toBe(false)
  })
})

describe('功法羁绊', () => {
  it('攻击系 ≥3 激活攻伐无双', () => {
    const ids = ['a', 'b', 'c']
    // 用真实表：三部攻击法诀
    const list = ['gf_jifeng', 'gf_liedi', 'gf_bengshan']
    const syn = activeSynergies(list)
    expect(syn.some((s) => s.rule.id === 'syn_attack3')).toBe(true)
    void ids
  })

  it('synergyBonus 累加效果', () => {
    const b = synergyBonus(['gf_jifeng', 'gf_liedi', 'gf_bengshan'])
    expect(b.atk).toBeGreaterThan(0)
  })
})
