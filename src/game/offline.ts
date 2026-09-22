import { CLASSES } from '../data/classes'
import { realmIndex } from '../data/realms'
import type { ClassId, RealmId } from '../types'

/** 各大境界离线时长上限（小时） */
export const OFFLINE_HOUR_CAP: Record<RealmId, number> = {
  qi: 8,
  foundation: 12,
  golden_core: 16,
  nascent_soul: 24,
  spirit_sea: 30,
  void: 36,
  integration: 42,
  mahayana: 48,
  tribulation: 48,
  ascended: 48,
}

/** 低于该时长不弹结算（毫秒） */
export const OFFLINE_MIN_MS = 5 * 60 * 1000
/** 离线相对打坐的效率 */
export const OFFLINE_EFFICIENCY = 0.85
/** 灵石加深额外收益比例 */
export const OFFLINE_STONE_BONUS = 0.5
/** 丹药加深额外收益比例 */
export const OFFLINE_PILL_BONUS = 0.25
/** 可用于加深闭关的丹药（有 exp 效果的消耗品） */
export const OFFLINE_PILL_IDS = ['pill_qi', 'pill_great', 'snake_gall', 'fox_core']

export interface OfflineSettlement {
  active: boolean
  reason?: 'clock_backward' | 'too_short' | 'ok'
  /** 实际经过毫秒（校正后） */
  elapsedMs: number
  hoursRaw: number
  hoursCounted: number
  capHours: number
  expPerHour: number
  expGain: number
  deepenStoneCost: number
  deepenStoneExp: number
  deepenPillExp: number
}

/** 离线每小时基准修为：与打坐同源，不含随机波动 */
export function offlineExpPerHour(
  classId: ClassId,
  realm: RealmId,
  layer: number,
  multipliers = 1,
): number {
  const rate = CLASSES[classId]?.cultivateRate ?? 1
  const ri = Math.max(0, realmIndex(realm))
  const base = 12 * Math.pow(1.32, ri) * (1 + (Math.max(1, layer) - 1) * 0.18)
  return Math.max(3, Math.floor(base * rate * multipliers * OFFLINE_EFFICIENCY))
}

export function offlineCapHours(realm: RealmId): number {
  return OFFLINE_HOUR_CAP[realm] ?? 8
}

export function offlineDeepenStoneCost(hoursCounted: number, realm: RealmId): number {
  const ri = Math.max(0, realmIndex(realm))
  return Math.max(20, Math.ceil(hoursCounted * (20 + ri * 15)))
}

export function calcOfflineCultivation(opts: {
  lastOnlineAt: number
  now: number
  classId: ClassId
  realm: RealmId
  layer: number
  /** 已合并的修炼倍率（道痕/宗门/功法/道侣等） */
  multipliers: number
}): OfflineSettlement {
  const { lastOnlineAt, now, classId, realm, layer, multipliers } = opts
  const capHours = offlineCapHours(realm)
  const expPerHour = offlineExpPerHour(classId, realm, layer, multipliers)

  const empty = (reason: OfflineSettlement['reason']): OfflineSettlement => ({
    active: false,
    reason,
    elapsedMs: 0,
    hoursRaw: 0,
    hoursCounted: 0,
    capHours,
    expPerHour,
    expGain: 0,
    deepenStoneCost: 0,
    deepenStoneExp: 0,
    deepenPillExp: 0,
  })

  if (!Number.isFinite(lastOnlineAt) || lastOnlineAt <= 0) return empty('too_short')

  // 改系统时间回拨：不结算，避免刷收益
  if (now < lastOnlineAt) return empty('clock_backward')

  const elapsedMs = now - lastOnlineAt
  if (elapsedMs < OFFLINE_MIN_MS) return empty('too_short')

  const hoursRaw = elapsedMs / 3600000
  const hoursCounted = Math.min(hoursRaw, capHours)
  const expGain = Math.floor(expPerHour * hoursCounted)
  const deepenStoneCost = offlineDeepenStoneCost(hoursCounted, realm)
  const deepenStoneExp = Math.floor(expGain * OFFLINE_STONE_BONUS)
  const deepenPillExp = Math.floor(expGain * OFFLINE_PILL_BONUS)

  return {
    active: true,
    reason: 'ok',
    elapsedMs,
    hoursRaw,
    hoursCounted,
    capHours,
    expPerHour,
    expGain,
    deepenStoneCost,
    deepenStoneExp,
    deepenPillExp,
  }
}

export function formatOfflineDuration(ms: number): string {
  const totalMin = Math.floor(ms / 60000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h <= 0) return `${m} 分钟`
  if (m === 0) return `${h} 小时`
  return `${h} 小时 ${m} 分`
}
