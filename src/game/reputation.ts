/**
 * 正魔声望与立场（R-31）：双声望是「江湖口碑」（可累积浮动），
 * alignment 是「当前立场」（重大节点显式改写，缺省由双声望推导）。
 */
import type { Alignment } from '../types'

/** 正/魔声望档位阈值 */
export const REP_TITLE_THRESHOLD = 100
/** 正道名宿：坊市九折 */
export const REP_MARKET_DISCOUNT = 0.9
/** 正道名宿：宗门委托贡献 +10% */
export const REP_TASK_CONTRIB_MUL = 1.1
/** 魔道魁首：历练灵石收益 +10% */
export const REP_EXPLORE_STONE_MUL = 1.1

export interface ReputationTitles {
  righteous: string | null
  demonic: string | null
  /** 正魔声望皆极盛：骑墙之辈，两边都不认 */
  mixed: boolean
  /**
   * 称号被当前立场遮蔽：声望够格，但立场与之相悖（如魔道立场却顶着正道声望）。
   * 仅在确有遮蔽时出现该字段（旧调用点的 toEqual 断言不受影响）。
   */
  masked?: 'demonic' | 'righteous'
}

/**
 * 双声望称号：正/魔称号互斥 —— 只有声望明显占优的一方可得称号。
 * 两边都过线时只得「亦正亦邪」，避免「正道名宿」与「魔道魁首」同时加身。
 *
 * v1.7：加入立场。声望是「江湖口碑」，立场是「此身自处」，两者本不同源；
 * 但魔道立场者顶着「正道名宿」会与灵气类型（魔元）自相矛盾，故此处让立场遮蔽相悖称号。
 */
export function reputationTitles(
  repRight: number,
  repDemonic: number,
  alignment?: Alignment,
): ReputationTitles {
  const rightOk = repRight >= REP_TITLE_THRESHOLD
  const demonOk = repDemonic >= REP_TITLE_THRESHOLD
  let righteous: string | null = rightOk ? '正道名宿' : null
  let demonic: string | null = demonOk ? '魔道魁首' : null
  let masked: 'demonic' | 'righteous' | undefined
  // 魔道立场：不授正道称号；正道立场：不授魔道称号
  if (alignment === 'demonic' && righteous) {
    righteous = null
    masked = 'demonic'
  }
  if (alignment === 'righteous' && demonic) {
    demonic = null
    masked = 'righteous'
  }
  if (righteous && demonic) return { righteous: null, demonic: null, mixed: true }
  const out: ReputationTitles = { righteous, demonic, mixed: false }
  if (masked) out.masked = masked
  return out
}

export function isRighteousParagon(repRight: number, repDemonic = 0): boolean {
  return repRight >= REP_TITLE_THRESHOLD && repDemonic < REP_TITLE_THRESHOLD
}

export function isDemonicChampion(repDemonic: number, repRight = 0): boolean {
  return repDemonic >= REP_TITLE_THRESHOLD && repRight < REP_TITLE_THRESHOLD
}

/** 道侣阵营是否与你立场相斥（正魔之恋）——全项目唯一判定入口 */
export function isCrossAlignment(demonic: boolean, align: Alignment): boolean {
  if (demonic) return align === 'righteous'
  return align === 'demonic'
}

/**
 * R-31：立场（alignment）与道途正交。
 * 声望推导立场的阈值：某一方声望过线（30，即「血誓入魔」同名门槛）且明显压过另一方时，
 * 江湖才以此人自居；血誓/屠村/投案/洗魔等重大节点由事件显式写入 alignment，不等推导。
 */
export const ALIGNMENT_REP_THRESHOLD = 30

/** 由双声望推导立场（未显式标记时的兜底口径，全项目唯一） */
export function deriveAlignment(repRight: number, repDemonic: number): Alignment {
  if (repDemonic >= ALIGNMENT_REP_THRESHOLD && repDemonic > repRight) return 'demonic'
  if (repRight >= ALIGNMENT_REP_THRESHOLD && repRight > repDemonic) return 'righteous'
  return 'neutral'
}

/**
 * 取玩家当前立场：显式 alignment 优先，否则由双声望实时推导。
 * 兼容旧档（无 alignment 字段）。
 */
export function resolveAlignment(p: {
  alignment?: Alignment
  repRight?: number
  repDemonic?: number
} | null | undefined): Alignment {
  if (!p) return 'neutral'
  if (p.alignment === 'righteous' || p.alignment === 'demonic' || p.alignment === 'neutral') {
    return p.alignment
  }
  return deriveAlignment(p.repRight ?? 0, p.repDemonic ?? 0)
}
