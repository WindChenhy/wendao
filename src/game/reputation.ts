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
}

/** 双声望称号（可同时持有正魔称号） */
export function reputationTitles(repRight: number, repDemonic: number): ReputationTitles {
  return {
    righteous: repRight >= REP_TITLE_THRESHOLD ? '正道名宿' : null,
    demonic: repDemonic >= REP_TITLE_THRESHOLD ? '魔道魁首' : null,
  }
}

export function isRighteousParagon(repRight: number): boolean {
  return repRight >= REP_TITLE_THRESHOLD
}

export function isDemonicChampion(repDemonic: number): boolean {
  return repDemonic >= REP_TITLE_THRESHOLD
}
