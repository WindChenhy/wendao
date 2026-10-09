import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import {
  buildPlayerCombatActor,
  createCombatState,
  defaultAutoAction,
  runCombatAuto,
  stepCombat,
  type CombatPetInfo,
} from './combatEngine'
import type { EnemyDef } from '../types'

/** 固定 Math.random 后战斗完全确定：0.5 时无暴击、敌人不放技能 */
const WOLF: EnemyDef = {
  id: 'e_wolf',
  name: '妖狼',
  faction: 'beast',
  realm: 'qi',
  layer: 1,
  atk: 20,
  def: 0,
  hp: 100000,
  loot: { exp: 50, stone: 20 },
  flavor: '',
}

function mkPlayer(over: Partial<Parameters<typeof buildPlayerCombatActor>[0]> = {}) {
  return buildPlayerCombatActor({
    name: '云无羁',
    classId: 'sword',
    realm: 'qi',
    layer: 1,
    hp: 200,
    maxHp: 200,
    energy: 50,
    maxEnergy: 100,
    atk: 50,
    def: 10,
    dmgReduce: 0,
    treasures: [],
    ...over,
  })
}

function ctx(pet?: CombatPetInfo) {
  return {
    kind: 'explore' as const,
    title: '历练',
    enemy: WOLF,
    hpScale: 1,
    ...(pet ? { pet } : {}),
  }
}

function petInfo(skillId: CombatPetInfo['skillId'], skillName: string): CombatPetInfo {
  return { name: '小云', skillId, skillName, assistChance: 1, cd: 3, power: 0.6 }
}

describe('战斗引擎基础', () => {
  let randSpy: MockInstance<() => number>
  beforeEach(() => {
    randSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
  })
  afterEach(() => {
    randSpy.mockRestore()
  })

  it('createCombatState 生成初始日志与未结束状态', () => {
    const s = createCombatState(mkPlayer(), WOLF, ctx())
    expect(s.round).toBe(0)
    expect(s.finished).toBe(false)
    expect(s.win).toBe(false)
    expect(s.enemy.maxHp).toBe(100000)
    expect(s.log.some((l) => l.text.includes('【历练】妖狼'))).toBe(true)
    expect(s.log.some((l) => l.text.includes('VS'))).toBe(true)
  })

  it('玩家连续 attack 数回合后敌方 HP 下降', () => {
    const s = createCombatState(mkPlayer(), WOLF, ctx())
    stepCombat(s, { type: 'attack' }, {}, 'qi', 1)
    stepCombat(s, { type: 'attack' }, {}, 'qi', 1)
    expect(s.enemy.hp).toBeLessThan(WOLF.hp)
    expect(s.enemy.hp).toBeGreaterThan(0)
    expect(s.finished).toBe(false)
  })

  it('敌方 HP 归零后 checkEnd 置 finished/win 并写战败日志', () => {
    const weak: EnemyDef = { ...WOLF, hp: 120, atk: 0, name: '弱妖' }
    const s = createCombatState(mkPlayer(), weak, { ...ctx(), enemy: weak })
    for (let i = 0; i < 6 && !s.finished; i++) stepCombat(s, { type: 'attack' }, {}, 'qi', 1)
    expect(s.finished).toBe(true)
    expect(s.win).toBe(true)
    expect(s.enemy.hp).toBe(0)
    expect(s.log[s.log.length - 1]?.text).toContain('倒下了')
  })

  it('runCombatAuto 用 defaultAutoAction 跑完整场战斗并返回结算', () => {
    const weak: EnemyDef = { ...WOLF, hp: 100, atk: 0, name: '弱妖' }
    const res = runCombatAuto(
      mkPlayer(),
      weak,
      { ...ctx(), enemy: weak },
      {},
      'qi',
      1,
      (st) => defaultAutoAction(st, {}, 'qi', 1),
    )
    expect(res.win).toBe(true)
    expect(res.rounds).toBeGreaterThanOrEqual(1)
    expect(res.expGain).toBe(50)
    expect(res.stoneGain).toBe(20)
    expect(res.playerHpLeft).toBeGreaterThan(0)
    expect(res.message).toContain('倒下')
  })
})

describe('灵兽协战（v1.3）', () => {
  let randSpy: MockInstance<() => number>
  beforeEach(() => {
    randSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
  })
  afterEach(() => {
    randSpy.mockRestore()
  })

  it('createCombatState 写出灵兽出战公告', () => {
    const s = createCombatState(mkPlayer(), WOLF, ctx(petInfo('pet_heal', '衔草')))
    expect(s.pet?.name).toBe('小云')
    expect(s.log.some((l) => l.text.includes('小云 随你出战') && l.text.includes('衔草'))).toBe(true)
  })

  it('pet_heal：cd 内（第 1、2 回合）不触发，第 3 回合回血并出现「灵兽·衔草」日志', () => {
    const s = createCombatState(mkPlayer(), WOLF, ctx(petInfo('pet_heal', '衔草')))
    stepCombat(s, { type: 'attack' }, {}, 'qi', 1)
    stepCombat(s, { type: 'attack' }, {}, 'qi', 1)
    expect(s.log.filter((l) => l.text.includes('灵兽·'))).toHaveLength(0)

    const hpBefore = s.player.hp
    stepCombat(s, { type: 'attack' }, {}, 'qi', 1)
    expect(s.log.some((l) => l.text.includes('灵兽·衔草') && l.text.includes('回复'))).toBe(true)
    expect(s.player.hp).toBeGreaterThan(hpBefore)
  })

  it('pet_debuff：第 3 回合触发虚弱，虚弱持续到敌方行动后、次回合初消散', () => {
    const s = createCombatState(mkPlayer(), WOLF, ctx(petInfo('pet_debuff', '清啸')))
    stepCombat(s, { type: 'attack' }, {}, 'qi', 1)
    stepCombat(s, { type: 'attack' }, {}, 'qi', 1)
    stepCombat(s, { type: 'attack' }, {}, 'qi', 1)
    expect(s.log.some((l) => l.text.includes('灵兽·清啸') && l.text.includes('陷入虚弱'))).toBe(true)
    // 协战在回合初状态结算之后触发：weaken(turns=1) 本回合内有效（含敌方行动），次回合初才被 tick 移除
    expect(s.enemy.statuses.some((st) => st.id === 'weaken')).toBe(true)
    stepCombat(s, { type: 'attack' }, {}, 'qi', 1)
    expect(s.enemy.statuses.some((st) => st.id === 'weaken')).toBe(false)
    expect(s.log.some((l) => l.text.includes('「虚弱」状态结束'))).toBe(true)
  })

  it('pet_shield：第 3 回合获得护盾并抵消伤害，护盾持续 2 回合后消散', () => {
    const s = createCombatState(mkPlayer(), WOLF, ctx(petInfo('pet_shield', '灵盾')))
    stepCombat(s, { type: 'attack' }, {}, 'qi', 1)
    stepCombat(s, { type: 'attack' }, {}, 'qi', 1)
    stepCombat(s, { type: 'attack' }, {}, 'qi', 1)
    const shield = s.player.statuses.find((st) => st.id === 'shield')
    expect(shield).toBeDefined()
    expect(shield?.value ?? 0).toBeGreaterThan(0)
    expect(s.log.some((l) => l.text.includes('灵兽·灵盾') && l.text.includes('展开灵盾'))).toBe(true)
    expect(s.log.some((l) => l.text.includes('被护盾抵消'))).toBe(true)

    // turns=2：第 4 回合仍在，第 5 回合初消散
    stepCombat(s, { type: 'attack' }, {}, 'qi', 1)
    expect(s.player.statuses.some((st) => st.id === 'shield')).toBe(true)
    stepCombat(s, { type: 'attack' }, {}, 'qi', 1)
    expect(s.player.statuses.some((st) => st.id === 'shield')).toBe(false)
    expect(s.log.some((l) => l.text.includes('护盾消散'))).toBe(true)
  })

  it('assistChance 概率不足时不触发协战', () => {
    randSpy.mockReturnValue(0.9)
    const pet: CombatPetInfo = { ...petInfo('pet_heal', '衔草'), assistChance: 0.5 }
    const s = createCombatState(mkPlayer(), WOLF, ctx(pet))
    for (let i = 0; i < 6; i++) stepCombat(s, { type: 'attack' }, {}, 'qi', 1)
    expect(s.log.filter((l) => l.text.includes('灵兽·'))).toHaveLength(0)
  })
})

describe('法宝闪避（treasureBonus.dodge 接线）', () => {
  let randSpy: MockInstance<() => number>
  beforeEach(() => {
    randSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5)
  })
  afterEach(() => {
    randSpy.mockRestore()
  })

  it('buildPlayerCombatActor 透传 dodge（缺省 0），敌方 actor 无 dodge', () => {
    expect(mkPlayer({ dodge: 0.25 }).dodge).toBe(0.25)
    expect(mkPlayer().dodge).toBe(0)
    const s = createCombatState(mkPlayer({ dodge: 0.25 }), WOLF, ctx())
    expect(s.enemy.dodge).toBeUndefined()
  })

  it('dodge=1：敌方攻击必被闪避且伤害为 0', () => {
    const s = createCombatState(mkPlayer({ dodge: 1 }), WOLF, ctx())
    const hp0 = s.player.hp
    stepCombat(s, { type: 'attack' }, {}, 'qi', 1)
    expect(s.player.hp).toBe(hp0)
    expect(s.log.some((l) => l.text.includes('身形一晃') && l.text.includes('避开了这一击'))).toBe(true)
  })

  it('dodge=0（缺省）：行为不变，敌方攻击照常造成伤害', () => {
    const s = createCombatState(mkPlayer(), WOLF, ctx())
    const hp0 = s.player.hp
    stepCombat(s, { type: 'attack' }, {}, 'qi', 1)
    expect(s.player.hp).toBeLessThan(hp0)
    expect(s.log.some((l) => l.text.includes('身形一晃'))).toBe(false)
  })

  it('防御回合的敌方攻击同样受闪避判定', () => {
    const s = createCombatState(mkPlayer({ dodge: 1 }), WOLF, ctx())
    const hp0 = s.player.hp
    stepCombat(s, { type: 'defend' }, {}, 'qi', 1)
    expect(s.player.hp).toBe(hp0)
    expect(s.log.some((l) => l.text.includes('避开了这一击'))).toBe(true)
  })
})
