import { realmIndex } from './realms'
import { sectRankIndex, type SectRank } from './sects'
import type { ClassId, RealmId } from '../types'
import eventsDb from './db/events.json'

export type WorldEventType =
  | 'secret_realm'
  | 'treasure'
  | 'boss'
  | 'fortune'
  | 'misfortune'
  | 'sect'
  | 'faction'
  | 'companion'
  | 'omen'

export type EventPack = 'core' | 'sect_storm' | 'faction_war' | 'omen' | 'dlc'

export interface EventCost {
  stones?: number
  contribution?: number
  items?: Record<string, number>
}

export interface EventOutcome {
  kind?: 'settle' | 'combat' | 'unlock_companion' | 'unlock_pet' | 'branch'
  /** 覆盖按钮文案的结算说明 */
  text?: string
  bossId?: string
  stones?: number
  exp?: number
  contribution?: number
  /** v1.1 贡献池增减（正入池 / 负扣池） */
  pool?: number
  repRight?: number
  repDemonic?: number
  itemId?: string
  daoMarks?: number
  lifespan?: number
  hpPct?: number
  flag?: string
  companionId?: string
  /** v1.2 灵兽认主 */
  petId?: string
  ending?: 'he' | 'be'
  /** combat 失败时的结算；缺省用 lose 文案 */
  win?: Omit<EventOutcome, 'kind' | 'bossId' | 'win' | 'lose'>
  lose?: Omit<EventOutcome, 'kind' | 'bossId' | 'win' | 'lose'>
}

export interface WorldEventAction {
  id: string
  label: string
  cost?: EventCost
  outcome?: EventOutcome
}

export interface EventGates {
  minRealm?: RealmId
  minLayer?: number
  maxRealm?: RealmId
  requireSect?: boolean
  sectId?: string
  minRank?: SectRank
  maxRank?: SectRank
  minRepRight?: number
  maxRepRight?: number
  minRepDemonic?: number
  maxRepDemonic?: number
  requireSpouse?: boolean
  spouseId?: string
  minYear?: number
  requireClass?: ClassId
  affinity?: { id: string; min: number }
  flags?: string[]
  notFlags?: string[]
}

export interface WorldEvent {
  id: string
  type: WorldEventType
  pack?: EventPack
  title: string
  text: string
  actions: WorldEventAction[]
  gates?: EventGates
  /** 抽取权重，默认 1 */
  weight?: number
  payload?: {
    itemId?: string
    stone?: number
    exp?: number
    bossId?: string
    minRealm?: RealmId
  }
}

export interface EventGateContext {
  realm: RealmId
  layer: number
  classId: ClassId
  year: number
  repRight: number
  repDemonic: number
  sectId: string | null
  sectRank: SectRank
  spouseId: string | null
  affinity: Record<string, number>
  flags: string[]
}

function passGates(gates: EventGates | undefined, ctx: EventGateContext): boolean {
  if (!gates) return true
  if (gates.minRealm && realmIndex(ctx.realm) < realmIndex(gates.minRealm)) return false
  if (gates.maxRealm && realmIndex(ctx.realm) > realmIndex(gates.maxRealm)) return false
  if (gates.minLayer && ctx.layer < gates.minLayer) return false
  if (gates.requireSect && !ctx.sectId) return false
  if (gates.sectId && ctx.sectId !== gates.sectId) return false
  if (gates.minRank && sectRankIndex(ctx.sectRank) < sectRankIndex(gates.minRank)) return false
  if (gates.maxRank && sectRankIndex(ctx.sectRank) > sectRankIndex(gates.maxRank)) return false
  if (gates.minRepRight != null && ctx.repRight < gates.minRepRight) return false
  if (gates.maxRepRight != null && ctx.repRight > gates.maxRepRight) return false
  if (gates.minRepDemonic != null && ctx.repDemonic < gates.minRepDemonic) return false
  if (gates.maxRepDemonic != null && ctx.repDemonic > gates.maxRepDemonic) return false
  if (gates.requireSpouse && !ctx.spouseId) return false
  if (gates.spouseId && ctx.spouseId !== gates.spouseId) return false
  if (gates.minYear && ctx.year < gates.minYear) return false
  if (gates.requireClass && ctx.classId !== gates.requireClass) return false
  if (gates.affinity) {
    const aff = ctx.affinity[gates.affinity.id] ?? 0
    if (aff < gates.affinity.min) return false
  }
  if (gates.flags?.length && !gates.flags.every((f) => ctx.flags.includes(f))) return false
  if (gates.notFlags?.length && gates.notFlags.some((f) => ctx.flags.includes(f))) return false
  return true
}

export function eventPassesGates(evt: WorldEvent, ctx: EventGateContext): boolean {
  // 兼容旧 payload.minRealm
  const legacyMin = evt.payload?.minRealm
  if (legacyMin && realmIndex(ctx.realm) < realmIndex(legacyMin)) return false
  return passGates(evt.gates, ctx)
}

/** 本体事件池（含 v0.9 主题包）；DLC 追加事件由 rules.extraEvents 合并 */
export const WORLD_EVENTS: WorldEvent[] = eventsDb.events as WorldEvent[]

/** 奇遇触发率：约 12% */
export const WORLD_EVENT_RATE = 0.12

/**
 * 按门槛过滤后加权抽取。ctx 不完整时退化为仅境界过滤。
 * 返回 null 表示本次未触发奇遇。
 */
export function pickWorldEvent(
  ctx: EventGateContext,
  extra: WorldEvent[] = [],
): WorldEvent | null {
  const pool = [...WORLD_EVENTS, ...extra].filter((e) => eventPassesGates(e, ctx))
  if (pool.length === 0) return null
  if (Math.random() > WORLD_EVENT_RATE) return null
  const weights = pool.map((e) => Math.max(0.05, e.weight ?? 1))
  const total = weights.reduce((a, b) => a + b, 0)
  let roll = Math.random() * total
  for (let i = 0; i < pool.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return pool[i]
  }
  return pool[pool.length - 1]
}
