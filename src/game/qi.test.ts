import { describe, expect, it } from 'vitest'
import { resolveQiType } from './qi'
import { reputationTitles } from './reputation'
import type { PlayerState } from '../types'

const base = (over: Partial<PlayerState> = {}): PlayerState =>
  ({
    name: '测试',
    gender: 'male',
    classId: 'sword',
    paths: ['sword'],
    realm: 'qi',
    layer: 1,
    exp: 0,
    hp: 100,
    maxHp: 100,
    energy: 50,
    maxEnergy: 50,
    age: 20,
    lifespanLeft: 60,
    alive: true,
    aptitude: 'mixed',
    shaqi: 0,
    repRight: 0,
    repDemonic: 0,
    heartDemon: 0,
    ...over,
  }) as PlayerState

describe('灵气类型判定（v1.7 唯一口径）', () => {
  it('正道之身为灵力', () => {
    const qi = resolveQiType(base({ repRight: 3739, repDemonic: -3401 }))
    expect(qi.label).toBe('灵力')
    expect(qi.reason).toBe('清修正法')
  })

  it('修魔功即魔元，与正道声望高低无关', () => {
    const qi = resolveQiType(
      base({ classId: 'demon', paths: ['demon'], repRight: 3739, repDemonic: -3401 }),
    )
    expect(qi.label).toBe('魔元')
    expect(qi.reason).toBe('主修魔道')
  })

  it('兼修魔道亦为魔元', () => {
    const qi = resolveQiType(base({ paths: ['sword', 'demon'] }))
    expect(qi.label).toBe('魔元')
    expect(qi.reason).toBe('兼修魔道')
  })

  it('未修魔功但立场为魔：魔元，原因为立场', () => {
    const qi = resolveQiType(base({ alignment: 'demonic' }))
    expect(qi.label).toBe('魔元')
    expect(qi.reason).toBe('立场为魔')
  })

  it('无道途无立场时由双声望推导', () => {
    expect(resolveQiType(base({ repDemonic: 200, repRight: 10 })).label).toBe('魔元')
    expect(resolveQiType(base({ repRight: 200, repDemonic: 10 })).label).toBe('灵力')
  })
})

describe('称号与立场（v1.7：相悖立场遮蔽称号）', () => {
  it('旧调用不变：只看双声望', () => {
    expect(reputationTitles(150, 20).righteous).toBe('正道名宿')
    expect(reputationTitles(20, 150).demonic).toBe('魔道魁首')
    expect(reputationTitles(99, 99)).toEqual({ righteous: null, demonic: null, mixed: false })
  })

  it('魔道立场不再顶着正道名宿', () => {
    const t = reputationTitles(3739, -3401, 'demonic')
    expect(t.righteous).toBeNull()
    expect(t.masked).toBe('demonic')
  })

  it('正道立场不授魔道魁首', () => {
    const t = reputationTitles(-100, 500, 'righteous')
    expect(t.demonic).toBeNull()
    expect(t.masked).toBe('righteous')
  })

  it('立场与称号同向时正常授予，且不带 masked 字段', () => {
    const t = reputationTitles(3739, -3401, 'righteous')
    expect(t.righteous).toBe('正道名宿')
    expect(t.masked).toBeUndefined()
  })
})
