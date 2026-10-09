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
  /** v1.4 灵兽喂养经验倍率 */
  petExpMul?: number
  /** v1.4 日课灵石奖励倍率 */
  dailyRewardMul?: number
  /** v1.4 仙缘获取倍率 */
  favorMul?: number
}

export interface DlcPack {
  manifest: DlcManifest
  /** 追加事件池（v1.4 起内置事件改为 events.json + dlcId 字段，此字段保留给外部数据包） */
  extraEvents?: WorldEvent[]
  balance?: DlcBalancePatch
}

const DLC_LIST_KEY = 'wendao-dlc-enabled'

export function loadEnabledDlc(): string[] {
  try {
    const raw = localStorage.getItem(DLC_LIST_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []
  } catch (e) {
      console.warn(e)
    return []
  }
}

export function saveEnabledDlc(ids: string[]): void {
  try {
    localStorage.setItem(DLC_LIST_KEY, JSON.stringify(ids))
  } catch (e) {
    console.warn(e)
    // 本地存储不可用时忽略，仅内存生效
  }
}

export interface RuntimeRules {
  cultivateMul: number
  breakthroughRateDelta: number
  lifespanMul: number
  exploreStoneMul: number
  petExpMul: number
  dailyRewardMul: number
  favorMul: number
  extraEvents: WorldEvent[]
  /** 已启用的 DLC id（供 dlcId 事件过滤与成就隐藏） */
  enabledIds: string[]
}

function defaultRules(): RuntimeRules {
  return {
    cultivateMul: 1,
    breakthroughRateDelta: 0,
    lifespanMul: 1,
    exploreStoneMul: 1,
    petExpMul: 1,
    dailyRewardMul: 1,
    favorMul: 1,
    extraEvents: [],
    enabledIds: [],
  }
}

/** 将已启用 DLC 合并为运行时规则（不执行任意代码，仅数据合并） */
export function combineRules(packs: DlcPack[], enabledIds: string[]): RuntimeRules {
  const rules = defaultRules()
  rules.enabledIds = [...enabledIds]
  for (const id of enabledIds) {
    const pack = packs.find((p) => p.manifest.id === id)
    if (!pack) continue
    if (pack.balance) {
      rules.cultivateMul *= pack.balance.cultivateMul ?? 1
      rules.breakthroughRateDelta += pack.balance.breakthroughRateDelta ?? 0
      rules.lifespanMul *= pack.balance.lifespanMul ?? 1
      rules.exploreStoneMul *= pack.balance.exploreStoneMul ?? 1
      rules.petExpMul *= pack.balance.petExpMul ?? 1
      rules.dailyRewardMul *= pack.balance.dailyRewardMul ?? 1
      rules.favorMul *= pack.balance.favorMul ?? 1
    }
    if (pack.extraEvents?.length) {
      rules.extraEvents.push(...pack.extraEvents)
    }
  }
  return rules
}
