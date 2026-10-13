/**
 * 道途（原「职业」）表与道途数值聚合。
 *
 * 世界观：修仙者以修仙为主，道途是在修行途中立下的（拜师、历练、实践顿悟、机缘）；
 * 创角时只定灵根与出身。首立之道为主修，其上再立者为兼修。
 * 兼修能吃到他道半数的属性与被动，却会拖慢修炼（「贪多嚼不烂」）。
 *
 * 数据：src/data/db/classes.json（道途表）
 */
import type { Alignment, AptitudeId, ClassDef, ClassId, RealmId } from '../types'
import { aptitudeOf } from './aptitudes'
import { deriveAlignment } from '../game/reputation'
import classesDb from './db/classes.json'

/** 未择道：尚未立下任何道途的散修（数值全中性） */
export const NO_PATH: ClassDef = {
  id: 'none',
  name: '未定道途',
  title: '散修',
  kind: 'combat',
  faction: 'neutral',
  desc: '未立道途，只以本命灵气按部就班地吐纳。',
  lore: '道在脚下，不在纸上。天下修士皆是先修仙、后择道——你尚未立道。',
  cultivateRate: 1,
  breakthroughBonus: 0,
  atkMul: 1,
  defMul: 1,
  hpMul: 1,
  tags: ['未择道'],
}

const RAW = classesDb as unknown as Record<string, ClassDef>

/** 全部道途 + 「未择道」占位（保证 CLASSES[classId] 永不 undefined） */
export const CLASSES: Record<ClassId, ClassDef> = { ...(RAW as Record<ClassId, ClassDef>), none: NO_PATH }

/** 可择之道途列表（不含「未择道」） */
export const PATH_LIST: ClassDef[] = Object.values(RAW)

export const PATH_MAP: Record<string, ClassDef> = RAW

export function isPathId(id: unknown): id is ClassId {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(RAW, id)
}

/** 兼修属性/突破折扣：兼修只得半数加成 */
export const SECONDARY_DISCOUNT = 0.5
/**
 * 每多一门兼修，修炼速度的拖累（D-7 拍板保守版：−5% → −2%）。
 * 调研结论：兼修的代价应主要来自资源竞争（兼修位、技能境界压制、参悟精力），
 * 而非硬性经验惩罚；−2% 仅保留「分心」意味。下限 0.6 为极端多道途的兜底，常态不可达。
 */
export const SECONDARY_DRAG = 0.02

/** 参入数值聚合的输入：道途 id / 道途 id 数组 / 带 classId(+paths/aptitude) 的对象（角色或参战者） */
export type PathInput =
  | ClassId
  | ClassId[]
  | {
      classId?: ClassId
      paths?: ClassId[]
      aptitude?: AptitudeId
      /** R-31：带立场/声望的玩家对象，isDemonic 判定时一并计入 */
      alignment?: Alignment
      repRight?: number
      repDemonic?: number
    }
  | null
  | undefined

/** 归一化为道途 id 列表：第 0 位为主修，其余为兼修（已去除 'none' 与重复） */
export function pathIdsOf(input: PathInput): ClassId[] {
  if (!input) return []
  let raw: ClassId[]
  if (typeof input === 'string') raw = [input]
  else if (Array.isArray(input)) raw = input
  else raw = [...(input.classId ? [input.classId] : []), ...(input.paths ?? [])]
  const out: ClassId[] = []
  for (const id of raw) {
    if (!id || id === 'none') continue
    if (!out.includes(id)) out.push(id)
  }
  return out
}

/** 是否已立某道途（主修或兼修皆算） */
export function hasPath(input: PathInput, id: ClassId): boolean {
  return pathIdsOf(input).includes(id)
}

/** 主修道途 id（未择道为 'none'） */
export function primaryPathId(input: PathInput): ClassId {
  return pathIdsOf(input)[0] ?? 'none'
}

/** 兼修道途 id 列表 */
export function secondaryPathIds(input: PathInput): ClassId[] {
  return pathIdsOf(input).slice(1)
}

/** 道途的数值效果（主修全额，兼修半数） */
export interface PathMults {
  cultivateRate: number
  breakthroughBonus: number
  atkMul: number
  defMul: number
  hpMul: number
}

const NEUTRAL_MULTS: PathMults = {
  cultivateRate: 1,
  breakthroughBonus: 0,
  atkMul: 1,
  defMul: 1,
  hpMul: 1,
}

/** 纯道途聚合（不含灵根）：主修全额，兼修半数，并计入兼修修炼拖累 */
export function pathMults(input: PathInput): PathMults {
  const ids = pathIdsOf(input)
  if (ids.length === 0) return { ...NEUTRAL_MULTS }
  let cultivateRate = 1
  let breakthroughBonus = 0
  let atkMul = 1
  let defMul = 1
  let hpMul = 1
  ids.forEach((id, i) => {
    const c = CLASSES[id]
    if (!c) return
    const w = i === 0 ? 1 : SECONDARY_DISCOUNT
    if (i === 0) cultivateRate *= c.cultivateRate
    breakthroughBonus += c.breakthroughBonus * w
    atkMul *= 1 + (c.atkMul - 1) * w
    defMul *= 1 + (c.defMul - 1) * w
    hpMul *= 1 + (c.hpMul - 1) * w
  })
  const drag = Math.max(0.6, 1 - SECONDARY_DRAG * (ids.length - 1))
  return {
    cultivateRate: cultivateRate * drag,
    breakthroughBonus,
    atkMul,
    defMul,
    hpMul,
  }
}

/**
 * 角色最终数值 = 灵根资质 × 道途聚合。
 * 兼容旧档：无 aptitude 视为杂灵根（中性），无 paths 视为仅主修。
 */
export function playerMults(p: PathInput): PathMults {
  if (!p) return { ...NEUTRAL_MULTS }
  const a = aptitudeOf(typeof p === 'object' && !Array.isArray(p) ? p : null)
  const pm = pathMults(p)
  return {
    cultivateRate: a.cultivateRate * pm.cultivateRate,
    breakthroughBonus: a.breakthroughBonus + pm.breakthroughBonus,
    atkMul: a.atkMul * pm.atkMul,
    defMul: a.defMul * pm.defMul,
    hpMul: a.hpMul * pm.hpMul,
  }
}

/**
 * 是否「魔道中人」（R-31：道途 × 立场正交后的口径）。
 * 满足任一即为真：
 * 1. 已立魔道（道途层，兼容旧行为——魔功本身即是魔修手段）；
 * 2. 当前立场为魔（显式 alignment，或由双声望推导）——剑修屠村血祭亦可堕魔。
 */
export function isDemonic(input: PathInput): boolean {
  if (hasPath(input, 'demon')) return true
  if (input && typeof input === 'object' && !Array.isArray(input)) {
    // 显式立场优先：已声明正道/中立，则不以声望推导覆盖（与 resolveAlignment 口径一致）
    if (input.alignment === 'demonic') return true
    if (input.alignment === 'righteous' || input.alignment === 'neutral') return false
    // 未声明显式立场时，才由双声望推导
    if (
      (typeof input.repRight === 'number' || typeof input.repDemonic === 'number') &&
      deriveAlignment(input.repRight ?? 0, input.repDemonic ?? 0) === 'demonic'
    ) {
      return true
    }
  }
  return false
}

/** 禁忌道途（魂道/魔道）：立道即种心魔，且不占兼修位（R-24） */
export function isForbiddenPath(id: ClassId): boolean {
  return CLASSES[id]?.kind === 'forbidden'
}

/**
 * 实际占用兼修位的道途 id（R-24：禁忌道途以永久心魔为代价，不再占兼修位）。
 * 主修恒不占位。
 */
export function slottedSecondaryIds(input: PathInput): ClassId[] {
  return pathIdsOf(input)
    .slice(1)
    .filter((id) => !isForbiddenPath(id))
}

/** 已占用的兼修位数（不含禁忌道途） */
export function usedSecondarySlots(input: PathInput): number {
  return slottedSecondaryIds(input).length
}

/** 各境界可容纳的兼修道途数（主修以外） */
const SECONDARY_SLOTS: Record<RealmId, number> = {
  qi: 0,
  foundation: 1,
  golden_core: 2,
  nascent_soul: 2,
  spirit_sea: 3,
  void: 3,
  integration: 4,
  mahayana: 4,
  tribulation: 5,
  ascended: 5,
}

export function secondarySlots(realm: RealmId): number {
  return SECONDARY_SLOTS[realm] ?? 0
}

/** 兼修位文案，如「兼修位 1/2」（禁忌道途不占位，R-24） */
export function pathSlotText(input: PathInput, realm: RealmId): string {
  return `兼修位 ${usedSecondarySlots(input)}/${secondarySlots(realm)}`
}

/** 战斗/日志用道途称呼，如「剑道（兼修 2 门）」 */
export function pathSummaryText(input: PathInput | null | undefined): string {
  const ids = pathIdsOf(input as PathInput)
  if (ids.length === 0) return NO_PATH.name
  const head = CLASSES[ids[0]]?.name ?? NO_PATH.name
  return ids.length > 1 ? `${head}（兼修 ${ids.length - 1} 门）` : head
}

/** 是否为已立道途（用于 UI 判定） */
export function isPathDefined(id: ClassId): boolean {
  return id !== 'none' && Boolean(RAW[id])
}

/** 道途数值效果文案（UI 展示，主修口径） */
export function pathEffectText(def: ClassDef): string {
  const parts: string[] = []
  if (def.cultivateRate !== 1) parts.push(`修炼 ×${def.cultivateRate.toFixed(2)}`)
  if (def.breakthroughBonus) {
    parts.push(`突破 ${def.breakthroughBonus > 0 ? '+' : ''}${def.breakthroughBonus}%`)
  }
  if (def.atkMul !== 1) parts.push(`攻击 ×${def.atkMul.toFixed(2)}`)
  if (def.defMul !== 1) parts.push(`防御 ×${def.defMul.toFixed(2)}`)
  if (def.hpMul !== 1) parts.push(`气血 ×${def.hpMul.toFixed(2)}`)
  return parts.join(' · ') || '属性中性'
}
