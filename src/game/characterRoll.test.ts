import { describe, expect, it } from 'vitest'
import { APTITUDE_IDS } from '../data/aptitudes'
import { ROLL_CONFIG } from '../data/characterRoll'
import { ORIGIN_IDS } from '../data/origins'
import {
  affinityMul,
  aptitudeChancePct,
  aptitudeRollPresencePct,
  comboWeight,
  rollTalentOptions,
  talentKey,
} from './characterRoll'

/** 可复现的线性同余伪随机数发生器 */
function seededRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

describe('天命掷卷配置（character_roll.json）', () => {
  it('权重覆盖全部灵根与出身，且均为正数', () => {
    for (const a of APTITUDE_IDS) {
      expect(ROLL_CONFIG.aptitudeWeights[a], `灵根 ${a} 缺权重`).toBeGreaterThan(0)
    }
    for (const o of ORIGIN_IDS) {
      expect(ROLL_CONFIG.originWeights[o], `出身 ${o} 缺权重`).toBeGreaterThan(0)
    }
  })

  it('机缘亲和引用的 id 均有效', () => {
    for (const [origin, aff] of Object.entries(ROLL_CONFIG.affinity)) {
      expect(ORIGIN_IDS, `出身 ${origin} 应存在`).toContain(origin)
      for (const [apt, mul] of Object.entries(aff ?? {})) {
        expect(APTITUDE_IDS, `灵根 ${apt} 应存在`).toContain(apt)
        expect(mul, '亲和倍率应为正').toBeGreaterThan(0)
      }
    }
  })

  it('基础权重占比单调对应稀有度，且合计 100%', () => {
    const pct = (a: string) => aptitudeChancePct(ROLL_CONFIG, a as never)
    expect(pct('mutant')).toBeLessThan(pct('heaven'))
    expect(pct('heaven')).toBeLessThan(pct('true'))
    expect(pct('true')).toBeLessThan(pct('dual'))
    expect(pct('dual')).toBeLessThan(pct('mixed'))
    const total = APTITUDE_IDS.reduce(
      (s, a) => s + aptitudeChancePct(ROLL_CONFIG, a),
      0,
    )
    expect(Math.round(total)).toBe(100)
  })

  it('实测每卷出现率单调对应稀有度（模拟值，受卷内不重复约束压平）', () => {
    const pct = (a: string) => aptitudeRollPresencePct(ROLL_CONFIG, a as never)
    expect(pct('mutant')).toBeLessThan(pct('heaven'))
    expect(pct('heaven')).toBeLessThan(pct('true'))
    expect(pct('true')).toBeLessThan(pct('dual'))
    expect(pct('dual')).toBeLessThan(pct('mixed'))
    // 出现率合计 ≤ 400%（每卷 4 卡、灵根不重复）；同配置下缓存结果稳定
    const total = APTITUDE_IDS.reduce((s, a) => s + pct(a), 0)
    expect(total).toBeLessThanOrEqual(400)
    expect(pct('mixed')).toBeGreaterThan(pct('mutant') * 3)
  })
})

describe('affinityMul / comboWeight', () => {
  it('出身对灵根的机缘亲和生效（没落世家 → 天灵根 ×2）', () => {
    expect(affinityMul(ROLL_CONFIG, 'heaven', 'fallen')).toBe(2.0)
    expect(affinityMul(ROLL_CONFIG, 'heaven', 'merchant')).toBe(1)
    const base = ROLL_CONFIG.aptitudeWeights.heaven! * ROLL_CONFIG.originWeights.merchant!
    const boosted = ROLL_CONFIG.aptitudeWeights.heaven! * ROLL_CONFIG.originWeights.fallen!
    expect(comboWeight(ROLL_CONFIG, 'heaven', 'fallen')).toBe(boosted * 2.0)
    expect(comboWeight(ROLL_CONFIG, 'heaven', 'merchant')).toBe(base)
  })

  it('缺失/零权重组合返回 0（数据缺失保护）', () => {
    expect(comboWeight(ROLL_CONFIG, 'heaven', 'nonexistent' as never)).toBe(0)
  })
})

describe('rollTalentOptions', () => {
  it('每卷恰好 optionCount 个组合，卷内不重复', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const opts = rollTalentOptions(ROLL_CONFIG, seededRng(seed * 7919))
      expect(opts).toHaveLength(ROLL_CONFIG.optionCount)
      const keys = opts.map(talentKey)
      expect(new Set(keys).size, `seed=${seed} 卷内组合应不重复`).toBe(keys.length)
    }
  })

  it('distinctAptitudePerRoll：卷内灵根不重复（灵根数充足时）', () => {
    expect(ROLL_CONFIG.optionCount).toBeLessThanOrEqual(APTITUDE_IDS.length)
    for (let seed = 1; seed <= 30; seed++) {
      const opts = rollTalentOptions(ROLL_CONFIG, seededRng(seed * 104729))
      const apts = opts.map((o) => o.aptitude)
      expect(new Set(apts).size, `seed=${seed} 卷内灵根应不重复`).toBe(apts.length)
    }
  })

  it('同一种子结果可复现（确定性）', () => {
    const a = rollTalentOptions(ROLL_CONFIG, seededRng(42))
    const b = rollTalentOptions(ROLL_CONFIG, seededRng(42))
    expect(a.map(talentKey)).toEqual(b.map(talentKey))
  })

  it('重掷排除上一卷组合（跨卷不重复）', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const first = rollTalentOptions(ROLL_CONFIG, seededRng(seed * 31))
      const second = rollTalentOptions(
        ROLL_CONFIG,
        seededRng(seed * 31 + 1),
        new Set(first.map(talentKey)),
      )
      const keys1 = new Set(first.map(talentKey))
      for (const o of second) {
        expect(keys1.has(talentKey(o)), `seed=${seed} 上一卷组合不应再现`).toBe(false)
      }
    }
  })

  it('排除集过大导致池子不足时自动忽略排除', () => {
    // 排除所有组合 → 应回退为全池仍可掷出
    const all = rollTalentOptions(ROLL_CONFIG, seededRng(7))
    const hugeExclude = new Set<string>()
    for (const a of APTITUDE_IDS) for (const o of ORIGIN_IDS) hugeExclude.add(talentKey({ aptitude: a, origin: o }))
    // 全排除时兜底忽略排除 → 仍能掷出 optionCount 个
    const opts = rollTalentOptions(ROLL_CONFIG, seededRng(7), hugeExclude)
    expect(opts).toHaveLength(ROLL_CONFIG.optionCount)
    expect(all.length).toBeGreaterThan(0)
  })

  it('概率分布合理：大量抽样下稀有灵根频率显著低于常见灵根，机缘亲和提升目标组合频率', () => {
    const N = 4000
    let mutant = 0
    let mixed = 0
    let fallenHeaven = 0
    let merchantHeaven = 0
    for (let i = 0; i < N; i++) {
      const opts = rollTalentOptions(ROLL_CONFIG, seededRng(i * 2654435761 + 1))
      for (const o of opts) {
        if (o.aptitude === 'mutant') mutant++
        if (o.aptitude === 'mixed') mixed++
        if (o.aptitude === 'heaven' && o.origin === 'fallen') fallenHeaven++
        if (o.aptitude === 'heaven' && o.origin === 'merchant') merchantHeaven++
      }
    }
    // 杂灵根（基础权重 34）实测出现频率显著高于变异灵根（基础权重 2）
    // 注：卷内「灵根不重复」约束会压平频率比（实测约 5.6:1 而非权重比 17:1）
    expect(mixed).toBeGreaterThan(mutant * 3)
    // 机缘亲和：没落世家×天灵根（×2 亲和）应多于商贾之家×天灵根（无亲和）
    // 注：出身权重 fallen(12) < merchant(6) 的 2 倍正好抵消，亲和后应反超
    expect(fallenHeaven).toBeGreaterThan(merchantHeaven)
  })
})
