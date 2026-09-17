import type { WorldEvent } from '../data/events'

export interface DlcManifest {
  id: string
  name: string
  version: string
  desc: string
  features: string[]
}

export interface DlcBalancePatch {
  cultivateMul?: number
  breakthroughRateDelta?: number
  lifespanMul?: number
  exploreStoneMul?: number
}

export interface DlcPack {
  manifest: DlcManifest
  /** 追加事件池 */
  extraEvents?: WorldEvent[]
  balance?: DlcBalancePatch
}

export const DLC_LIST_KEY = 'wendao-dlc-enabled'

export function loadEnabledDlc(): string[] {
  try {
    const raw = localStorage.getItem(DLC_LIST_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function saveEnabledDlc(ids: string[]): void {
  localStorage.setItem(DLC_LIST_KEY, JSON.stringify(ids))
}

export interface RuntimeRules {
  cultivateMul: number
  breakthroughRateDelta: number
  lifespanMul: number
  exploreStoneMul: number
  extraEvents: WorldEvent[]
}

export function defaultRules(): RuntimeRules {
  return {
    cultivateMul: 1,
    breakthroughRateDelta: 0,
    lifespanMul: 1,
    exploreStoneMul: 1,
    extraEvents: [],
  }
}

/** 将已启用 DLC 合并为运行时规则（不执行任意代码，仅数据合并） */
export function combineRules(packs: DlcPack[], enabledIds: string[]): RuntimeRules {
  const rules = defaultRules()
  for (const id of enabledIds) {
    const pack = packs.find((p) => p.manifest.id === id)
    if (!pack) continue
    if (pack.balance) {
      rules.cultivateMul *= pack.balance.cultivateMul ?? 1
      rules.breakthroughRateDelta += pack.balance.breakthroughRateDelta ?? 0
      rules.lifespanMul *= pack.balance.lifespanMul ?? 1
      rules.exploreStoneMul *= pack.balance.exploreStoneMul ?? 1
    }
    if (pack.extraEvents?.length) {
      rules.extraEvents.push(...pack.extraEvents)
    }
  }
  return rules
}
