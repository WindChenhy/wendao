import { realmIndex } from './realms'
import { sectRankIndex, type SectRank } from './sects'
import type { ClassId, RealmId } from '../types'
import eventsDb from './db/events.json'

type WorldEventType =
  | 'secret_realm'
  | 'treasure'
  | 'boss'
  | 'fortune'
  | 'misfortune'
  | 'sect'
  | 'faction'
  | 'companion'
  | 'omen'

type EventPack = 'core' | 'sect_storm' | 'faction_war' | 'omen' | 'dlc' | 'demonic'

interface EventCost {
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
  /** v1.4 按当前层修为需求比例给修为（如 0.2 = 20%），与 exp 可叠加 */
  expPct?: number
  contribution?: number
  /** v1.1 贡献池增减（正入池 / 负扣池） */
  pool?: number
  repRight?: number
  repDemonic?: number
  itemId?: string
  daoMarks?: number
  /** v1.4 仙缘增减（正入负出） */
  favor?: number
  lifespan?: number
  hpPct?: number
  flag?: string
  companionId?: string
  /** v1.2 灵兽认主 */
  petId?: string
  /** v1.2 安抚/捕捉灵兽的成功率；缺省表示必定获得 */
  captureRate?: number
  /** captureRate 存在时失败结算的文案 */
  failText?: string
  ending?: 'he' | 'be'
  /** v1.4 通缉档位增减（正入负出，结算时夹在 0–5） */
  wanted?: number
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

interface EventGates {
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
  /** v1.4 通缉档位门槛（通缉制只对魔修生效） */
  minWanted?: number
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
  /** v1.4 所属 DLC 包 id：仅在对应包启用时入池 */
  dlcId?: string
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
  /** v1.4 通缉档位 */
  wanted: number
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
  if (gates.minWanted != null && ctx.wanted < gates.minWanted) return false
  if (gates.affinity) {
    const aff = ctx.affinity[gates.affinity.id] ?? 0
    if (aff < gates.affinity.min) return false
  }
  if (gates.flags?.length && !gates.flags.every((f) => ctx.flags.includes(f))) return false
  if (gates.notFlags?.length && gates.notFlags.some((f) => ctx.flags.includes(f))) return false
  return true
}

function eventPassesGates(evt: WorldEvent, ctx: EventGateContext): boolean {
  // 兼容旧 payload.minRealm
  const legacyMin = evt.payload?.minRealm
  if (legacyMin && realmIndex(ctx.realm) < realmIndex(legacyMin)) return false
  return passGates(evt.gates, ctx)
}

/** 本体事件池（含 v0.9 主题包）；DLC 追加事件由 rules.extraEvents 合并 */
const WORLD_EVENTS: WorldEvent[] = eventsDb.events as WorldEvent[]

/** 奇遇触发率：约 12% */
const WORLD_EVENT_RATE = 0.12

/**
 * 按门槛过滤后加权抽取。ctx 不完整时退化为仅境界过滤。
 * enabledDlc：已启用的 DLC id；带 dlcId 的事件仅在其包启用时入池。
 * 返回 null 表示本次未触发奇遇。
 */
export function pickWorldEvent(
  ctx: EventGateContext,
  extra: WorldEvent[] = [],
  enabledDlc: string[] = [],
): WorldEvent | null {
  const pool = [...WORLD_EVENTS, ...extra].filter(
    (e) => (!e.dlcId || enabledDlc.includes(e.dlcId)) && eventPassesGates(e, ctx),
  )
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

/** 按 id 取本体事件（v1.4 通缉追杀等显式触发用）；无则 null */
export function worldEventById(id: string): WorldEvent | null {
  return WORLD_EVENTS.find((e) => e.id === id) ?? null
}
