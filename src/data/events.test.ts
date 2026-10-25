import { describe, expect, it } from 'vitest'
import { WORLD_EVENTS, eventGatePasses, type EventGateContext } from './events'
import { dissolvePath } from '../game/paths'
import { deriveAlignment } from '../game/reputation'
import type { PlayerState } from '../types'

function ctx(over: Partial<EventGateContext> = {}): EventGateContext {
  return {
    realm: 'foundation',
    layer: 1,
    classId: 'sword',
    paths: [],
    year: 1,
    repRight: 0,
    repDemonic: 0,
    sectId: null,
    sectRank: 'menial',
    bonded: [],
    affinity: {},
    flags: [],
    wanted: 0,
    alignment: 'neutral',
    ...over,
  }
}

describe('R-25 洗魔事件链', () => {
  const ids = ['washmo_call', 'washmo_offering', 'washmo_trial', 'washmo_return']
  const chain = ids.map((id) => WORLD_EVENTS.find((e) => e.id === id))

  it('四环俱在且结构完整', () => {
    for (let i = 0; i < ids.length; i++) {
      expect(chain[i], `缺少事件 ${ids[i]}`).toBeTruthy()
      expect(chain[i]!.actions.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('初念仅对魔道立场开放；立誓后写入 washmo_1', () => {
    const call = chain[0]!
    expect(eventGatePasses(call, ctx({ alignment: 'neutral' }))).toBe(false)
    expect(eventGatePasses(call, ctx({ alignment: 'demonic' }))).toBe(true)
    const resolve = call.actions.find((a) => a.id === 'resolve')!
    expect(resolve.outcome?.flag).toBe('washmo_1')
  })

  it('后续三环按 flag 递进：洗魔为单向链条', () => {
    const offering = chain[1]!
    const trial = chain[2]!
    const ret = chain[3]!
    // 未立誓不可献功
    expect(eventGatePasses(offering, ctx({ alignment: 'demonic', flags: [] }))).toBe(false)
    expect(eventGatePasses(offering, ctx({ alignment: 'demonic', flags: ['washmo_1'] }))).toBe(true)
    // 未献功不可受雷罚（且须仍为魔道立场）
    expect(eventGatePasses(trial, ctx({ flags: ['washmo_1'] }))).toBe(false)
    expect(eventGatePasses(trial, ctx({ alignment: 'demonic', flags: ['washmo_2'] }))).toBe(true)
    expect(eventGatePasses(trial, ctx({ alignment: 'neutral', flags: ['washmo_2'] }))).toBe(false)
    // 未过雷罚不可归正
    expect(eventGatePasses(ret, ctx({ flags: ['washmo_2'] }))).toBe(false)
    expect(eventGatePasses(ret, ctx({ flags: ['washmo_3'] }))).toBe(true)
    // 受雷胜出写入 washmo_3
    expect(trial.actions.find((a) => a.id === 'endure')!.outcome?.win?.flag).toBe('washmo_3')
  })

  it('归正：散功归正清魔道/立场归正/心魔清零；带艺投诚保留魔功改立场', () => {
    const ret = chain[3]!
    const clean = ret.actions.find((a) => a.id === 'clean_break')!.outcome!
    expect(clean.removePath).toBe('demon')
    expect(clean.alignment).toBe('righteous')
    expect(clean.heartDemon).toBe(-100)

    const keep = ret.actions.find((a) => a.id === 'keep_art')!.outcome!
    expect(keep.removePath).toBeUndefined()
    expect(keep.alignment).toBe('neutral')
  })
})

describe('R-25 dissolvePath 散功规则', () => {
  function player(over: Partial<PlayerState> = {}): PlayerState {
    return {
      name: '测',
      gender: 'male',
      classId: 'demon',
      paths: [],
      realm: 'golden_core',
      layer: 1,
      exp: 0,
      hp: 100,
      maxHp: 100,
      energy: 50,
      maxEnergy: 50,
      shaqi: 0,
      age: 20,
      lifespanLeft: 200,
      repRight: 0,
      repDemonic: 50,
      alive: true,
      ascended: false,
      ...over,
    }
  }

  it('散主修：无兼修则退回未择道', () => {
    const p = dissolvePath(player({ classId: 'demon', paths: [] }), 'demon')
    expect(p.classId).toBe('none')
    expect(p.paths).toEqual([])
  })

  it('散主修：有兼修则兼修顺位接任主修', () => {
    const p = dissolvePath(player({ classId: 'demon', paths: ['sword', 'body'] }), 'demon')
    expect(p.classId).toBe('sword')
    expect(p.paths).toEqual(['body'])
  })

  it('散兼修：仅从列表移除，主修不变', () => {
    const p = dissolvePath(player({ classId: 'sword', paths: ['demon', 'body'] }), 'demon')
    expect(p.classId).toBe('sword')
    expect(p.paths).toEqual(['body'])
  })

  it('散未立之道：原样返回不变', () => {
    const p = dissolvePath(player({ classId: 'sword', paths: ['body'] }), 'demon')
    expect(p.classId).toBe('sword')
    expect(p.paths).toEqual(['body'])
  })
})

describe('R-31 立场事件门槛', () => {
  it('存在改写立场的事件（屠村分赃/血祭卖情报），且对中立玩家开放', () => {
    const eventWithAlignment = WORLD_EVENTS.find((e) =>
      e.actions.some((a) => a.outcome?.alignment === 'demonic'),
    )
    expect(eventWithAlignment).toBeTruthy()
    // 该事件不设立场门槛（未堕魔者亦可作恶，作恶后才堕魔）
    expect(
      eventGatePasses(
        eventWithAlignment!,
        ctx({ alignment: 'neutral', realm: 'tribulation', layer: 9, year: 999 }),
      ),
    ).toBe(true)
  })

  it('deriveAlignment 与门槛语义一致：声望过线即定立场', () => {
    expect(deriveAlignment(0, 40)).toBe('demonic')
    expect(deriveAlignment(40, 0)).toBe('righteous')
  })
})

describe('R-32 正魔恋事件线', () => {
  const ids = ['crosslove_sect_pressure', 'crosslove_master_orders', 'crosslove_elope']
  const evts = ids.map((id) => WORLD_EVENTS.find((e) => e.id === id))

  it('三条专属事件线齐备，均含 spouseId + 立场 双门槛', () => {
    for (let i = 0; i < ids.length; i++) {
      expect(evts[i], `缺少事件 ${ids[i]}`).toBeTruthy()
      expect(evts[i]!.gates?.spouseId, `${ids[i]} 缺 spouseId 门槛`).toBeTruthy()
      expect(evts[i]!.gates?.alignment, `${ids[i]} 缺立场门槛`).toBeTruthy()
      expect(evts[i]!.actions.length).toBeGreaterThanOrEqual(2)
    }
  })

  it('门槛严格：立场或道侣不符则不触发', () => {
    const pressure = evts[0]!
    // 正道 + 血梅 → 触发
    expect(
      eventGatePasses(pressure, ctx({ alignment: 'righteous', bonded: ['xue_mei'], sectId: 'qingyun' })),
    ).toBe(true)
    // 立场不符
    expect(
      eventGatePasses(pressure, ctx({ alignment: 'demonic', bonded: ['xue_mei'], sectId: 'qingyun' })),
    ).toBe(false)
    // 道侣不符
    expect(
      eventGatePasses(pressure, ctx({ alignment: 'righteous', bonded: ['lin_wan'], sectId: 'qingyun' })),
    ).toBe(false)
    // 多位结缘时命中其一即触发
    expect(
      eventGatePasses(pressure, ctx({ alignment: 'righteous', bonded: ['lin_wan', 'xue_mei'], sectId: 'qingyun' })),
    ).toBe(true)
  })

  it('分支影响好感/声望/结局标记', () => {
    const pressure = evts[0]!
    // 携侣叛门：好感 +、立场转魔、通缉 +1、结局标记 chosen
    const choose = pressure.actions.find((a) => a.id === 'choose_her')!.outcome!
    expect(choose.affinity).toBeGreaterThan(0)
    expect(choose.alignment).toBe('demonic')
    expect(choose.wanted).toBe(1)
    expect(choose.flag).toBe('crosslove_chosen')

    // 断绝自证：好感大幅下降、正道声望升、标记 broken
    const broke = pressure.actions.find((a) => a.id === 'break_up')!.outcome!
    expect(broke.affinity).toBeLessThan(0)
    expect(broke.repRight).toBeGreaterThan(0)
    expect(broke.flag).toBe('crosslove_broken')

    // 私奔抉择：改中立立场、标记 elope
    const elope = evts[2]!.actions.find((a) => a.id === 'elope')!.outcome!
    expect(elope.alignment).toBe('neutral')
    expect(elope.flag).toBe('crosslove_elope')
  })
})
