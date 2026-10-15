/**
 * 择道规则（纯函数，可单测）。
 *
 * 传统修仙写法：先修仙，途中或拜师、或历练、或百炼成技而一朝顿悟，才立下道途。
 * 因此「立道」是游戏进程中的事件，不是创角时的选择：
 *   首立之道 → 主修；其后立道 → 兼修，且受境界限制的兼修位约束。
 */
import {
  NO_PATH,
  isForbiddenPath,
  pathIdsOf,
  secondarySlots,
  usedSecondarySlots,
} from '../data/classes'
import { REALMS, realmIndex } from '../data/realms'
import { ARTIFACT_TIER_LABELS } from '../data/artifacts'
import {
  FORBIDDEN_PATH_HEART_DEMON,
  adjustHeartDemon,
} from './heartDemon'
import type { ClassDef, ClassId, MetaStats, PathStatKey, PlayerState, RealmId } from '../types'

/** 立道判定所需的修行履历 */
export interface PathProgressSource {
  realm: RealmId
  layer: number
  stats: MetaStats
  /** 秘境累计通关层数（由 towerBest 求和得出） */
  towerFloors: number
  repDemonic: number
  stones: number
  lifespanLeft: number
}

/** 秘境累计通关层数 */
export function totalTowerFloors(towerBest: Record<string, number>): number {
  return Object.values(towerBest ?? {}).reduce((a, b) => a + (Number(b) || 0), 0)
}

export const PATH_STAT_LABELS: Record<PathStatKey, string> = {
  combatsWon: '战斗获胜',
  combatsLost: '败北经历',
  pillsCrafted: '炼丹成功',
  artifactsForged: '炼器成功',
  towerFloors: '秘境通关层数',
  bestDanMarks: '最高丹纹',
  bestArtifactTier: '最高法宝品质档',
  maxSwordIntent: '剑意最高层数',
}

function statOf(src: PathProgressSource, key: PathStatKey): number {
  if (key === 'towerFloors') return src.towerFloors
  const v = src.stats?.[key]
  return Number.isFinite(v) ? Number(v) : 0
}

/** 法宝品质档中文名（R-27：0=未炼器, 1=凡品 … 4=仙器）——唯一来源在 data/artifacts，勿另写一份 */
function artifactTierLabel(tier: number): string {
  return ARTIFACT_TIER_LABELS[tier] ?? String(tier)
}

/** 单条履历条件的展示文案（R-27：质变型条件更直观） */
function pathStatText(key: PathStatKey, cur: number, need: number): string {
  const label = PATH_STAT_LABELS[key] ?? key
  if (key === 'bestDanMarks') return `最高丹纹 ${cur}纹/${need}纹（须出过 ${need} 纹丹）`
  if (key === 'bestArtifactTier') {
    return `最高法宝品质 ${artifactTierLabel(cur)}/${artifactTierLabel(need)}`
  }
  if (key === 'maxSwordIntent') return `单场剑意峰值 ${cur}层/${need}层`
  return `${label} ${cur}/${need}`
}

/** 单条条件进度 */
export interface PathReqProgress {
  label: string
  cur: number
  need: number
  met: boolean
  /** 展示文案，如「战斗获胜 5/8」 */
  text: string
  /** 代价型条件（灵石/寿元），cur 为持有量 */
  cost?: boolean
}

export interface PathUnlockStatus {
  ok: boolean
  /** 逐条条件（UI 展示用，含已满足项） */
  reqs: PathReqProgress[]
  /** 未满足项文案 */
  missing: string[]
  /** 是否已立此道 */
  owned: boolean
}

export interface UnlockCtx extends PathProgressSource {
  /** 已立道途（含主修） */
  ownedPaths: ClassId[]
}

const cmp = (cur: number, need: number): PathReqProgress => ({
  label: '',
  cur,
  need,
  met: cur >= need,
  text: `${cur}/${need}`,
})

function push(reqs: PathReqProgress[], r: PathReqProgress, label: string, text?: string) {
  reqs.push({ ...r, label, text: text ?? `${label} ${r.cur}/${r.need}` })
}

/**
 * 立道条件校验。返回逐条进度与是否可立。
 * 「已立此道」「兼修位不足」也作为未满足项返回，便于 UI 直接展示。
 */
export function pathUnlockStatus(def: ClassDef, ctx: UnlockCtx): PathUnlockStatus {
  const reqs: PathReqProgress[] = []
  const missing: string[] = []
  const owned = ctx.ownedPaths.includes(def.id)

  if (owned) {
    return { ok: false, owned: true, reqs, missing: ['已立此道'] }
  }

  const u = def.unlock
  if (u) {
    if (u.minRealm) {
      const minName = `${REALMS[u.minRealm]?.name ?? u.minRealm}${u.minLayer ?? 1}层`
      const need = realmIndex(u.minRealm) * 100 + (u.minLayer ?? 1)
      const cur = realmIndex(ctx.realm) * 100 + ctx.layer
      const r = cmp(cur, need)
      const curName = `${REALMS[ctx.realm]?.name ?? ctx.realm}${ctx.layer}层`
      push(reqs, r, '境界', `需${minName}（当前${curName}）`)
      if (!r.met) missing.push(`境界不足（需${minName}）`)
    }
    for (const [key, need] of Object.entries(u.stats ?? {}) as [PathStatKey, number][]) {
      const cur = statOf(ctx, key)
      // R-27：质变型条件用更具象的文案（丹纹/法宝品质/剑意层数）
      push(reqs, cmp(cur, need), PATH_STAT_LABELS[key] ?? key, pathStatText(key, cur, need))
      if (cur < need) {
        missing.push(`${PATH_STAT_LABELS[key] ?? key}不足（${cur}/${need}）`)
      }
    }
    if (u.repDemonic != null) {
      push(reqs, cmp(ctx.repDemonic, u.repDemonic), '魔道声望')
      if (ctx.repDemonic < u.repDemonic) {
        missing.push(`魔道声望不足（${ctx.repDemonic}/${u.repDemonic}）`)
      }
    }
    if (u.stoneCost) {
      const r = cmp(ctx.stones, u.stoneCost)
      r.cost = true
      push(reqs, r, '灵石')
      if (!r.met) missing.push(`灵石不足（${ctx.stones}/${u.stoneCost}）`)
    }
    if (u.lifespanCost) {
      const r = cmp(ctx.lifespanLeft, u.lifespanCost + 1)
      r.cost = true
      push(reqs, r, '寿元', `需耗 ${u.lifespanCost} 年（余 ${ctx.lifespanLeft} 年）`)
      if (!r.met) missing.push(`寿元不足（需耗 ${u.lifespanCost} 年）`)
    }
  }

  // 兼修位：主修不占位；R-24 起禁忌道途以心魔为代价，亦不占位
  const isFirst = pathIdsOf(ctx.ownedPaths).length === 0
  const isForbiddenNew = isForbiddenPath(def.id)
  const slots = secondarySlots(ctx.realm)
  const usedSecondaries = usedSecondarySlots(ctx.ownedPaths)
  const slotReq: PathReqProgress = {
    label: '兼修位',
    cur: isFirst ? 0 : usedSecondaries,
    need: slots,
    met: isFirst || isForbiddenNew || usedSecondaries < slots,
    text: isFirst
      ? '首立之道不占兼修位'
      : isForbiddenNew
        ? '禁忌道途不占兼修位（以心魔为代价）'
        : `兼修位 ${usedSecondaries}/${slots}`,
  }
  reqs.push(slotReq)
  if (!slotReq.met) {
    missing.push(`兼修位已满（${usedSecondaries}/${slots}，境界提升可增位）`)
  }

  const ok = reqs.every((r) => r.met)
  return { ok, owned: false, reqs, missing }
}

/** 立道时的代价结算（寿元/灵石；主修不占兼修位） */
export interface PathCost {
  stones: number
  lifespan: number
  repRight: number
}

export function pathCost(def: ClassDef): PathCost {
  const u = def.unlock
  return {
    stones: u?.stoneCost ?? 0,
    lifespan: u?.lifespanCost ?? 0,
    repRight: u?.repRightCost ?? 0,
  }
}

/** 改立主修的费用：随境界上浮 */
export function primarySwitchCost(realm: RealmId): number {
  return 200 * (realmIndex(realm) + 1)
}

/** 改立主修的闭关静养日数（R-25：洗炼道基须闭门重修） */
export const PRIMARY_SWITCH_SECLUSION_DAYS = 30
/** 改立主修的损寿比例（R-25：散功伤及根本，折损当前满寿元 5%） */
export const PRIMARY_SWITCH_LIFESPAN_PCT = 0.05

/** 立道日志文案 */
export function pathEnshrineText(def: ClassDef, isPrimary: boolean): string {
  const role = isPrimary ? '主修' : '兼修'
  return `你于道基之上铭下「${def.name}」，自此以${def.title}自居（${role}）。${def.lore}`
}

export interface EnshrineResult {
  /** 立道后的玩家状态（未过重算气血，调用方需走 recomputeVitals） */
  player: PlayerState
  isPrimary: boolean
  cost: PathCost
}

/**
 * 立道结算（纯函数，**不含任何门槛校验**）——R-21 起为两条入口共用的唯一规则：
 * - 自悟：pathSlice.choosePath，先过 pathUnlockStatus；
 * - 师承：sectSlice.sectLearn 命中藏经阁 kind:'path'，先过拜师窗口/职位/境界/贡献门槛。
 *
 * 师承免去「自悟履历」与「灵石之资」（门槛在各自调用方），
 * 但寿元之引与入魔血誓（正道声望代价）是道途本身的代价，此处一律照结。
 *
 * R-24：立禁忌道途（魂道/魔道）即种心魔（+20）——禁忌之道不占兼修位，代价是永久心魔债。
 */
export function enshrinePath(player: PlayerState, def: ClassDef): EnshrineResult {
  const isPrimary = pathIdsOf(player).length === 0
  const cost = pathCost(def)
  const heartDemon = isForbiddenPath(def.id)
    ? adjustHeartDemon(player.heartDemon, FORBIDDEN_PATH_HEART_DEMON)
    : player.heartDemon
  // R-31：血誓立魔道即显式堕入魔立场（可经 R-25 洗魔线清除，与道途解绑）
  const alignment = def.faction === 'demonic' ? ('demonic' as const) : player.alignment
  return {
    isPrimary,
    cost,
    player: {
      ...player,
      classId: (isPrimary ? def.id : player.classId) as ClassId,
      paths: isPrimary
        ? [...(player.paths ?? [])]
        : [...(player.paths ?? []), def.id as ClassId],
      repRight: player.repRight - cost.repRight,
      lifespanLeft: player.lifespanLeft - cost.lifespan,
      heartDemon,
      alignment,
    },
  }
}

/** 道途详情文案（UI 复用） */
export function pathBrief(def: ClassDef): string {
  return def.id === NO_PATH.id ? def.desc : `${def.desc}（主修全额，兼修半数加成）`
}

/**
 * 散去一门道途（R-25 洗魔线用，纯函数）。
 * - 散去主修：其余兼修按立道先后顺位接任主修；无兼修则退回未择道；
 * - 散去兼修：从列表移除即可。
 * 注意：心虚为「散去」而非「转立」，兼修位随之释放、心魔需外部另行结算。
 */
export function dissolvePath(player: PlayerState, pathId: ClassId): PlayerState {
  const ids = pathIdsOf(player).filter((id) => id !== pathId)
  const nextPrimary: ClassId = ids[0] ?? 'none'
  return {
    ...player,
    classId: nextPrimary,
    paths: nextPrimary === 'none' ? [] : ids.slice(1),
  }
}
