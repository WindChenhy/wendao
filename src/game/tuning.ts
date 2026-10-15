/** 玩法调参常量（集中管理） */
export const TUNING = {
  /** v18：心魔值 heartDemon + 独立立场 alignment（R-24/R-31） */
  saveVersion: 18,
  /** 丹纹对药效（气血/修为/灵力/灵石）的每纹倍率 */
  danMarkPerStack: 0.15,
  /** 丹纹对「突破成功率」的每纹加成（与药效倍率不同口径，勿混用） */
  danMarkBreakthroughPerStack: 0.04,
  overScopeEfficiency: 0.25,
  worldEventRate: 0.12,
  offlineMinMinutes: 5,
  spouseHurtDays: 7,
  sectFragmentCost: 3,
} as const

