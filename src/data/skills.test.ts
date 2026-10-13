import { describe, expect, it } from 'vitest'
import type { ClassId, RealmId } from '../types'
import {
  isSkillUnlocked,
  secondarySkillCapRealm,
  unlockedActiveSkillsForPaths,
  type SkillDef,
} from './skills'

/** 构造指定领悟境界的主动技 */
function activeSkill(id: string, classId: ClassId, realm: RealmId, layer = 1): SkillDef {
  return { id, classId, name: id, type: 'active', desc: '', unlock: { realm, layer } }
}

describe('R-22 兼修技艺境界上限 = 主修境界 − 1', () => {
  it('主修技能不受压制：元婴玩家可用元婴级主修技', () => {
    const sk = activeSkill('sk_x', 'sword', 'nascent_soul')
    expect(isSkillUnlocked(sk, 'nascent_soul', 1)).toBe(true)
  })

  it('兼修时同境界技能被压：元婴级剑道技在元婴丹修（剑为兼修）手中不可用', () => {
    const sk = activeSkill('sk_x', 'sword', 'nascent_soul')
    // 玩家元婴、剑为兼修：封顶 = 金丹（元婴 − 1），元婴技不可用
    expect(
      isSkillUnlocked(sk, 'nascent_soul', 1, { isSecondary: true, primaryRealm: 'nascent_soul' }),
    ).toBe(false)
    // 主修剑道的玩家同境界可用
    expect(isSkillUnlocked(sk, 'nascent_soul', 1)).toBe(true)
  })

  it('主修再进一境后，该兼修技解封（化神丹修可用元婴级剑技）', () => {
    const sk = activeSkill('sk_x', 'sword', 'nascent_soul')
    expect(
      isSkillUnlocked(sk, 'spirit_sea', 1, { isSecondary: true, primaryRealm: 'spirit_sea' }),
    ).toBe(true)
  })

  it('兼修的筑基技在筑基期被压、金丹期解封', () => {
    const sk = activeSkill('sk_x', 'sword', 'foundation')
    expect(
      isSkillUnlocked(sk, 'foundation', 1, { isSecondary: true, primaryRealm: 'foundation' }),
    ).toBe(false)
    expect(
      isSkillUnlocked(sk, 'golden_core', 1, { isSecondary: true, primaryRealm: 'golden_core' }),
    ).toBe(true)
  })

  it('封顶序号即主修境界序号 − 1', () => {
    expect(secondarySkillCapRealm('qi')).toBe(-1)
    expect(secondarySkillCapRealm('foundation')).toBe(0)
    expect(secondarySkillCapRealm('golden_core')).toBe(1)
    expect(secondarySkillCapRealm('nascent_soul')).toBe(2)
  })

  it('道途集合：首位主修技能全开放，其后兼修按封顶过滤', () => {
    // 用真实表：所有主动技仅 qi/foundation 领悟
    // 金丹玩家：主修丹道技能全可用，兼修剑道的筑基技也已解封（封顶=筑基序号 1）
    const atGc = unlockedActiveSkillsForPaths(['alchemy', 'sword'], 'golden_core', 1, 'golden_core')
    expect(atGc.some((s) => s.id === 'sk_alchemy_blast')).toBe(true)
    expect(atGc.some((s) => s.id === 'sk_sword_break')).toBe(true)

    // 筑基玩家：兼修剑道的筑基技被压（封顶=练气），但练气技可用
    const atFound = unlockedActiveSkillsForPaths(
      ['alchemy', 'sword'],
      'foundation',
      1,
      'foundation',
    )
    expect(atFound.some((s) => s.id === 'sk_sword_break')).toBe(false)
    expect(atFound.some((s) => s.id === 'sk_sword_combo')).toBe(true)

    // 不传 primaryRealm 时保持旧行为（不压制）
    const legacy = unlockedActiveSkillsForPaths(['alchemy', 'sword'], 'foundation', 1)
    expect(legacy.some((s) => s.id === 'sk_sword_break')).toBe(true)
  })
})
