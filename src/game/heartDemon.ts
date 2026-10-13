/**
 * 心魔值规则（R-24，纯函数）。
 *
 * 世界观依据《钟吕传道集·论魔难》：修行有「债」——
 * 立禁忌道途、施禁忌之术、突破失败、邪祟献祭都会在心性上留下裂痕，即心魔。
 * 心魔不自行消退，须靠清心丹、长久闭关、道侣护法等主动化解。
 */
import type { Alignment, PlayerState } from '../types'

/** 心魔值上下限 */
export const HEART_DEMON_MIN = 0
export const HEART_DEMON_MAX = 100

/** 立禁忌道途（魂道/魔道）时初生的心魔 */
export const FORBIDDEN_PATH_HEART_DEMON = 20
/** 突破一次失败，心魔 +5 */
export const BREAKTHROUGH_FAIL_HEART_DEMON = 5
/** 战斗中每施展一次禁忌技，心魔 +1（单场战斗至多 +3） */
export const FORBIDDEN_SKILL_HEART_DEMON = 1
export const FORBIDDEN_SKILL_GAIN_CAP = 3
/** 清心丹一颗消减的心魔 */
export const CLEANSE_PILL_HEART_DEMON = 15
/** 长久闭关（≥7 日）一次消减的心魔 */
export const SECLUSION_HEART_DEMON = 3

/**
 * 心魔劫阈值：心魔 ≥60 时，大境界突破会额外引动心魔劫（与 R-28 抽劫机制联动）。
 */
export const HEART_DEMON_TRIBULATION_THRESHOLD = 60

/** 夹取到合法区间的心魔值 */
export function clampHeartDemon(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(HEART_DEMON_MIN, Math.min(HEART_DEMON_MAX, Math.floor(value)))
}

/** 心魔增减（delta 正入负出），返回夹取后的新值 */
export function adjustHeartDemon(current: number | undefined, delta: number): number {
  return clampHeartDemon((current ?? 0) + delta)
}

/** 心魔对突破成功率的压制：每 10 点 −1%（−floor(hd/10)） */
export function heartDemonBreakthroughPenalty(heartDemon: number | undefined): number {
  return Math.floor(clampHeartDemon(heartDemon ?? 0) / 10)
}

/** 心魔是否深重到会引动心魔劫 */
export function heartDemonTribulation(heartDemon: number | undefined): boolean {
  return clampHeartDemon(heartDemon ?? 0) >= HEART_DEMON_TRIBULATION_THRESHOLD
}

/** 立场文案 */
export const ALIGNMENT_LABEL: Record<Alignment, string> = {
  righteous: '正道',
  neutral: '中立',
  demonic: '魔道',
}

/** 玩家状态上的心魔安全取值（旧档无字段时为 0） */
export function heartDemonOf(player: Pick<PlayerState, 'heartDemon'> | null | undefined): number {
  return clampHeartDemon(player?.heartDemon ?? 0)
}
