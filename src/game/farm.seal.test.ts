import { describe, expect, it } from 'vitest'
import { remapFarmPlots, makeFarmGrid, migrateAbode, plotProgress } from './farm'
import { FARM_BASE_COLS, FARM_BASE_ROWS, FARM_MAX_COUNT } from '../data/abode'
import { sealSlots, sealDaoCost } from './seal'
import { softenSeverity, isTribulationMoment, tribulationPlan } from '../data/tribulation'
import { TUNING } from './tuning'
import { treasureBreakthroughTotal } from './combatStats'

describe('灵田网格', () => {
  it('初始 36 格，最大 128', () => {
    expect(FARM_BASE_COLS * FARM_BASE_ROWS).toBe(36)
    expect(FARM_MAX_COUNT).toBe(128)
  })

  it('扩地 remap 保留左上种植', () => {
    const old = makeFarmGrid(2, 2)
    old[0] = { seedId: 'seed_qi', plantedDay: 1 }
    old[3] = { seedId: 'seed_moon', plantedDay: 2 }
    const next = remapFarmPlots(old, 2, 2, 3, 2)
    expect(next).toHaveLength(6)
    expect(next[0].seedId).toBe('seed_qi')
    expect(next[4].seedId).toBe('seed_moon') // row1,col1 -> 1*3+1
  })

  it('migrateAbode 旧档补到 6×6', () => {
    const ab = migrateAbode({ plots: [{ seedId: null, plantedDay: 0 }], forgeLevel: 1 })
    expect(ab.farmCols).toBe(6)
    expect(ab.farmRows).toBe(6)
    expect(ab.plots).toHaveLength(36)
    expect(ab.forgeLevel).toBe(1)
  })
})

describe('转生封印与天劫', () => {
  it('封印槽随道痕解锁，上限 3', () => {
    expect(sealSlots(0)).toBe(1)
    expect(sealSlots(240)).toBe(3)
    expect(sealSlots(10000)).toBe(3)
    expect(sealDaoCost('mortal')).toBe(0)
    expect(sealDaoCost('treasure')).toBeGreaterThan(0)
  })

  it('天劫方案与失败降档', () => {
    expect(isTribulationMoment('qi', 1, 9)).toBe(false)
    expect(isTribulationMoment('qi', 9, 9)).toBe(true)
    expect(softenSeverity('critical')).toBe('major')
    expect(softenSeverity('minor')).toBe('minor')
    expect(tribulationPlan('force').rateDelta).toBeLessThan(0)
  })
})

describe('调参与突破合计', () => {
  it('TUNING 常量合理', () => {
    expect(TUNING.danMarkPerStack).toBeGreaterThan(0)
    expect(TUNING.worldEventRate).toBeGreaterThan(0)
    expect(TUNING.worldEventRate).toBeLessThan(1)
  })

  it('treasureBreakthroughTotal 含基础加成', () => {
    expect(treasureBreakthroughTotal(['treasure_compass'])).toBeGreaterThanOrEqual(8)
    expect(treasureBreakthroughTotal([])).toBe(0)
  })
})

describe('plotProgress', () => {
  it('未种植为未成熟', () => {
    const p = plotProgress({ seedId: null, plantedDay: 0 }, { year: 1, month: 1, day: 1 })
    expect(p.ready).toBe(false)
  })
})
