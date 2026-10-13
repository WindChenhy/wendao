import { APTITUDE_IDS } from '../data/aptitudes'
import { ROLL_CONFIG } from '../data/characterRoll'
import { ORIGIN_IDS } from '../data/origins'
import type { AptitudeId, CharacterRollConfig, OriginId } from '../types'

/**
 * 创角「天道掷卷」纯函数模块：
 * 灵根/出身各有基础权重（配置于 character_roll.json），
 * 出身对灵根有机缘亲和倍率（如没落世家 → 天灵根 ×2），
 * 每卷在不重复的组合池中做加权不放回抽样，并尽量保证卷内灵根不重复。
 */
export interface TalentOption {
  aptitude: AptitudeId
  origin: OriginId
}

/** 组合唯一键（用于卷内去重与跨卷排除） */
export function talentKey(o: TalentOption): string {
  return `${o.aptitude}|${o.origin}`
}

/** 机缘亲和倍率：出身 origin 对灵根 apt 的权重乘数（缺省 1） */
export function affinityMul(
  cfg: CharacterRollConfig,
  apt: AptitudeId,
  origin: OriginId,
): number {
  return cfg.affinity[origin]?.[apt] ?? 1
}

/** 「灵根×出身」组合的最终权重 = 灵根权重 × 出身权重 × 机缘亲和 */
export function comboWeight(
  cfg: CharacterRollConfig,
  apt: AptitudeId,
  origin: OriginId,
): number {
  const aw = cfg.aptitudeWeights[apt] ?? 0
  const ow = cfg.originWeights[origin] ?? 0
  if (aw <= 0 || ow <= 0) return 0
  return aw * ow * affinityMul(cfg, apt, origin)
}

/** 灵根的基础权重占比（%，仅按灵根权重池；用于配置完整性校验） */
export function aptitudeChancePct(cfg: CharacterRollConfig, apt: AptitudeId): number {
  const total = APTITUDE_IDS.reduce((s, a) => s + (cfg.aptitudeWeights[a] ?? 0), 0)
  if (total <= 0) return 0
  return ((cfg.aptitudeWeights[apt] ?? 0) / total) * 100
}

/** 确定性伪随机（线性同余），供模拟统计使用：同配置下结果可复现 */
function seededRng(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

/**
 * 灵根「每卷出现率」（%）：大规模模拟掷卷后，统计含该灵根的卷占比。
 * 卷内「灵根不重复」约束会压平单卡频率（权重 34:2 实测约 5.6:1 而非 17:1），
 * 基础权重占比不等于玩家实际见到该卡的频率——因此 UI 展示用本模拟值，口径才真实。
 * 结果按配置对象缓存（模拟次数固定、随机源确定，同配置恒等）。
 */
const PRESENCE_TRIALS = 2000
const presenceCache = new WeakMap<CharacterRollConfig, Map<AptitudeId, number>>()

export function aptitudeRollPresencePct(cfg: CharacterRollConfig, apt: AptitudeId): number {
  let cache = presenceCache.get(cfg)
  if (!cache) {
    const counts = new Map<AptitudeId, number>()
    const rnd = seededRng(20261013)
    for (let i = 0; i < PRESENCE_TRIALS; i++) {
      const seen = new Set(rollTalentOptions(cfg, rnd).map((o) => o.aptitude))
      for (const a of seen) counts.set(a, (counts.get(a) ?? 0) + 1)
    }
    cache = new Map()
    for (const a of APTITUDE_IDS) {
      cache.set(a, ((counts.get(a) ?? 0) / PRESENCE_TRIALS) * 100)
    }
    presenceCache.set(cfg, cache)
  }
  return cache.get(apt) ?? 0
}

/** 加权随机取一（weights 需非全 0） */
function weightedPick<T>(items: T[], weight: (t: T) => number, rnd: () => number): T {
  let total = 0
  for (const it of items) total += weight(it)
  let r = rnd() * total
  for (const it of items) {
    r -= weight(it)
    if (r <= 0) return it
  }
  return items[items.length - 1]!
}

/**
 * 掷出一卷天命：count 个不重复组合。
 * - 卷内组合不重复（不放回抽样）；
 * - distinctAptitudePerRoll 为真时，卷内灵根尽量不重复（灵根数不足名额时自动放宽）；
 * - excludeKeys 用于跨卷多样性：重掷时排除上一卷出现过的组合（池子不足时自动忽略）。
 */
export function rollTalentOptions(
  cfg: CharacterRollConfig = ROLL_CONFIG,
  rnd: () => number = Math.random,
  excludeKeys: ReadonlySet<string> = new Set<string>(),
): TalentOption[] {
  const count = Math.max(1, cfg.optionCount)
  const all: TalentOption[] = []
  for (const aptitude of APTITUDE_IDS) {
    for (const origin of ORIGIN_IDS) all.push({ aptitude, origin })
  }
  // 跨卷排除：池子够大才生效，否则忽略排除条件
  let pool = all.filter((o) => !excludeKeys.has(talentKey(o)))
  if (pool.length < count) pool = all
  // 剔除权重为 0 的非法组合（数据缺失保护）
  pool = pool.filter((o) => comboWeight(cfg, o.aptitude, o.origin) > 0)
  if (pool.length === 0) return []

  const picked: TalentOption[] = []
  const usedApt = new Set<AptitudeId>()
  while (picked.length < count && pool.length > 0) {
    const remaining = count - picked.length
    const unusedAptCount = APTITUDE_IDS.filter((a) => !usedApt.has(a)).length
    const enforceDistinct = cfg.distinctAptitudePerRoll && unusedAptCount >= remaining
    let cands = enforceDistinct ? pool.filter((o) => !usedApt.has(o.aptitude)) : pool
    if (cands.length === 0) cands = pool // 兜底：约束无解时放宽
    const opt = weightedPick(cands, (o) => comboWeight(cfg, o.aptitude, o.origin), rnd)
    picked.push(opt)
    usedApt.add(opt.aptitude)
    const key = talentKey(opt)
    pool = pool.filter((o) => talentKey(o) !== key)
  }
  return picked
}
