import { describe, expect, it } from 'vitest'
import { evaluateAchievementIds, type AchievementProgressInput } from './achievements'
import { ACHIEVEMENTS, TAIXU_PALACE_FLOORS } from './achievements'

function baseInput(): AchievementProgressInput {
  return {
    player: null,
    legacy: {
      daoMarks: 0,
      reincarnations: 0,
      bestRealmIndex: 0,
      totalYears: 0,
      lastLifeEndYear: 0,
      sealed: [],
    },
    stones: 0,
    gongfaCount: 0,
    treasureCount: 0,
    companion: { spouseId: null, heartsSeen: {}, affinity: {} },
    sect: { rank: 'menial', sectId: null },
    towerBest: {},
    collection: { realm: [], enemy: [], gongfa: [], item: [], companion: [], secret: [] },
    stats: { combatsWon: 0, combatsLost: 0, pillsCrafted: 0, artifactsForged: 0, stonesPeak: 0, offlineSettled: 0 },
  }
}

describe('v1.4 飞升终局成就', () => {
  it('favor_100：仙缘达 100 解锁，不足不解锁', () => {
    expect(evaluateAchievementIds({ ...baseInput(), favor: 99 })).not.toContain('favor_100')
    expect(evaluateAchievementIds({ ...baseInput(), favor: 100 })).toContain('favor_100')
  })

  it('taixu_clear：太虚仙阙贯通全部层数解锁（阈值取自秘境表，不是硬编码魔数）', () => {
    const input = baseInput()
    expect(evaluateAchievementIds(input)).not.toContain('taixu_clear')
    input.towerBest = { taixu_palace: TAIXU_PALACE_FLOORS - 1 }
    expect(evaluateAchievementIds(input)).not.toContain('taixu_clear')
    input.towerBest = { taixu_palace: TAIXU_PALACE_FLOORS }
    expect(evaluateAchievementIds(input)).toContain('taixu_clear')
    expect(TAIXU_PALACE_FLOORS).toBeGreaterThanOrEqual(99)
  })
})

describe('v1.4 DLC 专属成就门控', () => {  it('未启用包时不判定（条件满足也不解锁）', () => {
    const input = baseInput()
    input.stats = { ...input.stats, combatsWon: 50 }
    input.favor = 80
    input.pet = { level: 20, broken: true, bond: 100 }
    input.towerBest = { taixu_palace: 40 }
    input.wanted = 5
    const ids = evaluateAchievementIds(input)
    expect(ids).not.toContain('dlc_war_kill10')
    expect(ids).not.toContain('dlc_war_notorious')
    expect(ids).not.toContain('dlc_pet_lv10')
    expect(ids).not.toContain('dlc_pet_bond100')
    expect(ids).not.toContain('dlc_relic_favor50')
    expect(ids).not.toContain('dlc_relic_taixu30')
  })

  it('启用包后按条件解锁', () => {
    const input = baseInput()
    input.enabledDlc = ['demonic_war', 'beast_taming', 'immortal_relic']
    input.stats = { ...input.stats, combatsWon: 10 }
    input.wanted = 5
    input.pet = { level: 10, broken: false, bond: 100 }
    input.favor = 50
    input.towerBest = { taixu_palace: 30 }
    const ids = evaluateAchievementIds(input)
    expect(ids).toContain('dlc_war_kill10')
    expect(ids).toContain('dlc_war_notorious')
    expect(ids).toContain('dlc_pet_lv10')
    expect(ids).toContain('dlc_pet_bond100')
    expect(ids).toContain('dlc_relic_favor50')
    expect(ids).toContain('dlc_relic_taixu30')
  })

  it('无灵兽时不触发御兽成就', () => {
    const input = baseInput()
    input.enabledDlc = ['beast_taming']
    expect(evaluateAchievementIds(input)).not.toContain('dlc_pet_lv10')
  })

  it('6 条 DLC 成就均已注册且归属正确', () => {
    const all = ACHIEVEMENTS.map((a) => a.id)
    for (const ids of Object.values(
      { d: ['dlc_war_kill10', 'dlc_war_notorious'], b: ['dlc_pet_lv10', 'dlc_pet_bond100'], r: ['dlc_relic_favor50', 'dlc_relic_taixu30'] },
    )) {
      for (const id of ids) expect(all).toContain(id)
    }
  })
})

describe('v1.5 道途成就', () => {
  it('未择道不解锁，立道/兼修/六道同修按道途数递进', () => {
    expect(evaluateAchievementIds(baseInput())).not.toContain('path_first')
    expect(evaluateAchievementIds({ ...baseInput(), pathCount: 1 })).toContain('path_first')
    expect(evaluateAchievementIds({ ...baseInput(), pathCount: 2 })).not.toContain('path_dual')
    expect(evaluateAchievementIds({ ...baseInput(), pathCount: 3 })).toContain('path_dual')
    expect(evaluateAchievementIds({ ...baseInput(), pathCount: 6 })).toContain('path_all')
    expect(evaluateAchievementIds({ ...baseInput(), pathCount: 5 })).not.toContain('path_all')
  })

  it('境界链成就覆盖全部大境界（合体/大乘/渡劫不再缺失）', () => {
    const all = ACHIEVEMENTS.map((a) => a.id)
    for (const id of [
      'realm_foundation',
      'realm_core',
      'realm_soul',
      'realm_spirit',
      'realm_void',
      'realm_integration',
      'realm_mahayana',
      'realm_tribulation',
      'realm_ascend',
    ]) {
      expect(all, `缺少境界成就 ${id}`).toContain(id)
    }
  })
})
