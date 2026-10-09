import { beforeAll, describe, expect, it, vi } from 'vitest'
import type { CompanionState, GongfaLearned, PlayerState, SectState } from '../../types'
import { cultivateMultipliers } from './progress'

beforeAll(() => {
  // currentRules → loadEnabledDlc 读取 localStorage；node 环境下桩掉以走 BUILTIN_DLC 默认规则
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {} })
})

/** 最小状态：仅令各乘区取中性值，隔离出法宝 cultivate 乘区 */
const player = { realm: 'qi' } as unknown as PlayerState
const sect = {
  sectId: null,
  rank: '',
  contribution: 0,
  learned: [],
  taskDoneOn: '',
  examPassed: false,
  quest: null,
  libraryLv: 0,
  marketLv: 0,
  questsDone: 0,
  fragmentsUsed: 0,
  pool: 0,
  buildings: {},
} as unknown as SectState
const companion = {
  affinity: {},
  heartsSeen: {},
  spouseId: null,
  dualDoneOn: '',
  postStage: {},
  endings: {},
} as unknown as CompanionState

function mul(treasures: string[] = [], gongfa: Record<string, GongfaLearned> = {}): number {
  return cultivateMultipliers(player, sect, companion, gongfa, 0, treasures)
}

describe('cultivateMultipliers 并入法宝修炼加成', () => {
  it('无法宝（或缺省）时倍率不变，即直乘 1', () => {
    expect(mul()).toBe(mul([]))
  })

  it('修向法宝按原值直乘（treasure_lotus cultivate 0.12）', () => {
    expect(mul(['treasure_lotus'])).toBeCloseTo(mul() * 1.12)
  })

  it('v1.3 道韵青莲 cultivate 0.18 生效', () => {
    expect(mul(['treasure_dao_lotus'])).toBeCloseTo(mul() * 1.18)
  })

  it('多件修向法宝乘算叠加（lotus 0.12 × qin 0.15），dodge 不影响修炼', () => {
    expect(mul(['treasure_lotus', 'treasure_qin'])).toBeCloseTo(mul() * 1.12 * 1.15)
  })
})
