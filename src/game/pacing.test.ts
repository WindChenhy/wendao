import { describe, expect, it } from 'vitest'
import { cultivateGain, GAME_DAYS_PER_YEAR } from './day'
import { expNeeded, REALMS, REALM_ORDER } from '../data/realms'

/**
 * R-13 寿元与修为曲线匹配（决策 D-4 拍板 A 配套）。
 *
 * 测算口径：未择道、无任何加成的纯打坐（variance=期望 1），
 * 只计"打坐攒修为"的日子；实战中采药/炼丹/事件/突破失败会拉长，
 * 灵根/道痕/功法/宗门/法宝加成会缩短。对照表同步写入 README。
 */
interface PaceRow {
  realm: string
  /** 自练气一层起，纯打坐抵达该境圆满的累计年数 */
  cumYears: number
  lifespan: number
  /** 累计打坐年数 / 该境满寿元 */
  ratio: number
}

function paceTable(): PaceRow[] {
  let cumDays = 0
  const rows: PaceRow[] = []
  for (const r of REALM_ORDER) {
    if (r === 'ascended') continue
    for (let layer = 1; layer <= REALMS[r].layers; layer += 1) {
      const daily = cultivateGain({ classId: 'none', paths: [] }, r, layer, 1)
      cumDays += expNeeded(r, layer) / daily
    }
    const cumYears = cumDays / GAME_DAYS_PER_YEAR
    rows.push({
      realm: r,
      cumYears,
      lifespan: REALMS[r].lifespan,
      ratio: cumYears / REALMS[r].lifespan,
    })
  }
  return rows
}

describe('R-13 修炼节奏 × 寿元对照表', () => {
  const table = paceTable()

  it('各境寿元严格递增', () => {
    for (let i = 1; i < table.length; i += 1) {
      expect(table[i].lifespan, `${table[i].realm} 寿元低于前一境`).toBeGreaterThan(
        table[i - 1].lifespan,
      )
    }
  })

  it('前期节奏轻快：练气一年内、筑基三年内可纯打坐通关（教学期不被寿元卡住）', () => {
    const qi = table.find((r) => r.realm === 'qi')!
    const foundation = table.find((r) => r.realm === 'foundation')!
    expect(qi.cumYears).toBeLessThan(1)
    expect(foundation.cumYears).toBeLessThan(3)
  })

  it('寿元压力随境界单调抬升，至合体进入 20%+ 压力区，且纯打坐理论上全程可通关', () => {
    for (let i = 1; i < table.length; i += 1) {
      expect(table[i].ratio, `${table[i].realm} 寿元压力较前境回落`).toBeGreaterThanOrEqual(
        table[i - 1].ratio,
      )
    }
    const integration = table.find((r) => r.realm === 'integration')!
    expect(integration.ratio).toBeGreaterThanOrEqual(0.2)
    for (const row of table) {
      expect(row.ratio, `${row.realm} 纯打坐年数已超过满寿元，无解`).toBeLessThan(1)
    }
  })

  it('输出对照表（调试用：npm test -- --reporter=verbose 可见）', () => {
    // 故意非空断言失败时打印全表，便于调平衡
    const lines = table.map(
      (r) =>
        `${r.realm.padEnd(14)} 累计打坐 ${r.cumYears.toFixed(1).padStart(8)} 年 / 寿元 ${String(r.lifespan).padStart(6)} = ${(r.ratio * 100).toFixed(1)}%`,
    )
    // eslint-disable-next-line no-console
    console.log('\n' + lines.join('\n'))
    expect(table.length).toBe(9)
  })
})
