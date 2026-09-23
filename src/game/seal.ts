/** v1.0 周目传承物：转生封印 */
export type SealedKind = 'gongfa' | 'artifact'

export interface SealedItem {
  kind: SealedKind
  /** gongfa id 或 artifact itemId */
  id: string
  /** 展示名 */
  name: string
  /** gongfa：前世最高阶段（残卷以入门带入，进阶消耗降低） */
  stage?: number
  /** artifact：品质与词条 */
  quality?: 'mortal' | 'spirit' | 'treasure' | 'immortal'
  affixes?: { id: string }[]
  /** 额外扣除的道痕（宝器以上封印代价） */
  daoCost?: number
}

/** 封印槽：道痕里程碑解锁，上限 3 */
export function sealSlots(daoMarks: number): number {
  return Math.min(3, 1 + Math.floor(Math.max(0, daoMarks) / 120))
}

/** 封印法宝品质是否需要额外道痕 */
export function sealDaoCost(quality: SealedItem['quality']): number {
  if (quality === 'treasure') return 8
  if (quality === 'immortal') return 16
  return 0
}

export function describeSealed(s: SealedItem): string {
  const kind = s.kind === 'gongfa' ? '功法残卷' : '法宝'
  return `${kind}「${s.name}」`
}
