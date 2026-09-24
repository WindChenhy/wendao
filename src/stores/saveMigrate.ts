import { emptyCollection } from '../data/codex'
import { GONGFAS, gongfaByScrollId, isMarketGongfa } from '../data/gongfa'
import { questChainById, type SectQuestState } from '../data/sectQuests'
import { PET_MAP, type PetState, type PetJob } from '../data/pets'
import type { SectRank } from '../data/sects'
import { REALM_ORDER, realmIndex } from '../data/realms'
import { isAscended } from '../game/reincarnate'
import type { SealedItem } from '../game/seal'
import type {
  CollectionState,
  LegacyState,
  MetaState,
  PlayerState,
} from '../types'
import type {
  CompanionState,
  GongfaLearned,
  GongfaState,
  SectState,
} from './gameStateTypes'

export function uniqIds(list: string[]): string[] {
  return Array.from(new Set(list.filter(Boolean)))
}

export function freshSect(): SectState {
  return {
    sectId: null,
    rank: 'menial',
    contribution: 0,
    learned: [],
    taskDoneOn: '',
    examPassed: false,
    quest: null,
    libraryLv: 0,
    marketLv: 0,
    questsDone: 0,
    fragmentsUsed: 0,
    pool: 0,
    buildings: { spirit_vein: 0, alchemy_lab: 0, sword_grave: 0 },
  }
}

/** 旧存档身份 → 新职位体系（v4 及更早） */
const LEGACY_RANK_MAP: Record<string, SectRank> = {
  menial: 'menial',
  outer: 'outer',
  inner: 'inner',
  personal: 'personal',
  true: 'true',
  steward: 'steward',
  elder: 'elder',
  grand_elder: 'grand_elder',
  master: 'master',
  supreme: 'supreme',
  disciple: 'outer',
}

/** 清理背包中的无效秘籍（宗门秘法不产生秘籍物品，防历史脏数据绕过贡献参悟） */
export function sanitizeInventory(inv: Record<string, number>): Record<string, number> {
  const out = { ...inv }
  for (const id of Object.keys(out)) {
    const g = gongfaByScrollId(id)
    if (g && !isMarketGongfa(g)) delete out[id]
  }
  return out
}

export function migrateGongfa(raw: unknown, sectLearned?: string[]): GongfaState {
  const learned: Record<string, GongfaLearned> = {}
  if (raw && typeof raw === 'object') {
    const r = raw as GongfaState
    if (r.learned && typeof r.learned === 'object') {
      for (const [id, st] of Object.entries(r.learned)) {
        if (!GONGFAS[id] || !st) continue
        learned[id] = { stage: Math.min(3, Math.max(0, Number(st.stage) || 0)) }
      }
    }
  }
  if (sectLearned) {
    for (const id of sectLearned) {
      if (GONGFAS[id] && !learned[id]) learned[id] = { stage: 0 }
    }
  }
  return { learned }
}

export function migrateSect(raw: unknown): SectState {
  const base = freshSect()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Partial<SectState> & { rank?: string; quest?: Partial<SectQuestState> | null }
  const questRaw = r.quest
  const quest: SectQuestState | null =
    questRaw && typeof questRaw === 'object' && questRaw.chainId
      ? {
          chainId: String(questRaw.chainId),
          stepIndex: Math.max(0, Number(questRaw.stepIndex) || 0),
          progress: Math.max(0, Number(questRaw.progress) || 0),
          completedSteps: Math.max(0, Number(questRaw.completedSteps) || 0),
        }
      : null
  return {
    ...base,
    sectId: r.sectId ?? null,
    rank: LEGACY_RANK_MAP[r.rank ?? ''] ?? (r.sectId ? 'outer' : 'menial'),
    contribution: Number(r.contribution) || 0,
    learned: Array.isArray(r.learned) ? r.learned.filter((x) => typeof x === 'string') : [],
    taskDoneOn: typeof r.taskDoneOn === 'string' ? r.taskDoneOn : '',
    examPassed: Boolean(r.examPassed),
    quest: quest && questChainById(quest.chainId) ? quest : null,
    libraryLv: Math.max(0, Math.min(3, Number(r.libraryLv) || 0)),
    marketLv: Math.max(0, Math.min(3, Number(r.marketLv) || 0)),
    questsDone: Math.max(0, Number(r.questsDone) || 0),
    fragmentsUsed: Math.max(0, Number(r.fragmentsUsed) || 0),
    pool: Math.max(0, Number(r.pool) || 0),
    buildings: {
      spirit_vein: Math.max(0, Math.min(5, Number(r.buildings?.spirit_vein) || 0)),
      alchemy_lab: Math.max(0, Math.min(5, Number(r.buildings?.alchemy_lab) || 0)),
      sword_grave: Math.max(0, Math.min(5, Number(r.buildings?.sword_grave) || 0)),
    },
  }
}

export function freshCompanion(): CompanionState {
  return {
    affinity: {},
    heartsSeen: {},
    spouseId: null,
    dualDoneOn: '',
    postStage: {},
    endings: {},
    flags: [],
    hiddenUnlocked: [],
    farmHelpOn: '',
    pillHelpOn: '',
    spouseHurtUntilDay: 0,
  }
}

export function migrateCompanion(raw: unknown): CompanionState {
  const base = freshCompanion()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Partial<CompanionState>
  const affinity: Record<string, number> = {}
  if (r.affinity && typeof r.affinity === 'object') {
    for (const [k, v] of Object.entries(r.affinity)) {
      if (typeof v === 'number') affinity[k] = v
    }
  }
  const heartsSeen: Record<string, number> = {}
  if (r.heartsSeen && typeof r.heartsSeen === 'object') {
    for (const [k, v] of Object.entries(r.heartsSeen)) {
      if (typeof v === 'number') heartsSeen[k] = v
    }
  }
  const postStage: Record<string, number> = {}
  if (r.postStage && typeof r.postStage === 'object') {
    for (const [k, v] of Object.entries(r.postStage)) {
      if (typeof v === 'number') postStage[k] = v
    }
  }
  const endings: Record<string, 'he' | 'be'> = {}
  if (r.endings && typeof r.endings === 'object') {
    for (const [k, v] of Object.entries(r.endings)) {
      if (v === 'he' || v === 'be') endings[k] = v
    }
  }
  return {
    affinity,
    heartsSeen,
    spouseId: typeof r.spouseId === 'string' && r.spouseId ? r.spouseId : null,
    dualDoneOn: typeof r.dualDoneOn === 'string' ? r.dualDoneOn : '',
    postStage,
    endings,
    flags: Array.isArray(r.flags) ? uniqIds(r.flags.map(String)) : [],
    hiddenUnlocked: Array.isArray(r.hiddenUnlocked) ? uniqIds(r.hiddenUnlocked.map(String)) : [],
    farmHelpOn: typeof r.farmHelpOn === 'string' ? r.farmHelpOn : '',
    pillHelpOn: typeof r.pillHelpOn === 'string' ? r.pillHelpOn : '',
    spouseHurtUntilDay: typeof r.spouseHurtUntilDay === 'number' ? r.spouseHurtUntilDay : 0,
  }
}

export function freshGongfa(): GongfaState {
  return { learned: {} }
}

export function freshLegacy(): LegacyState {
  return {
    daoMarks: 0,
    reincarnations: 0,
    bestRealmIndex: 0,
    totalYears: 0,
    lastLifeEndYear: 0,
    sealed: [],
  }
}

export function migrateLegacy(raw: unknown): LegacyState {
  const base = freshLegacy()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Partial<LegacyState>
  const sealed: SealedItem[] = Array.isArray(r.sealed)
    ? r.sealed
        .filter((x) => x && typeof x === 'object' && x.id)
        .map((x) => ({
          kind: x.kind === 'artifact' ? ('artifact' as const) : ('gongfa' as const),
          id: String(x.id),
          name: String(x.name ?? x.id),
          stage: typeof x.stage === 'number' ? x.stage : undefined,
          quality: x.quality,
          affixes: Array.isArray(x.affixes) ? x.affixes : undefined,
          daoCost: typeof x.daoCost === 'number' ? x.daoCost : undefined,
        }))
    : []
  return {
    daoMarks: Number(r.daoMarks) || 0,
    reincarnations: Number(r.reincarnations) || 0,
    bestRealmIndex: Number(r.bestRealmIndex) || 0,
    totalYears: Number(r.totalYears) || 0,
    lastLifeEndYear: Number(r.lastLifeEndYear) || 0,
    sealed,
  }
}

export function freshMeta(): MetaState {
  return {
    collection: emptyCollection(),
    achievements: [],
    codexRewardClaimed: [],
    titles: [],
    stats: { combatsWon: 0, pillsCrafted: 0, stonesPeak: 0, offlineSettled: 0 },
    lastOnlineAt: Date.now(),
  }
}

export function migrateMeta(raw: unknown): MetaState {
  const base = freshMeta()
  if (!raw || typeof raw !== 'object') return base
  const r = raw as Partial<MetaState> & { collection?: Partial<CollectionState> }
  const col: Partial<CollectionState> = r.collection ?? {}
  return {
    collection: {
      realm: uniqIds(col.realm ?? []),
      enemy: uniqIds(col.enemy ?? []),
      gongfa: uniqIds(col.gongfa ?? []),
      item: uniqIds(col.item ?? []),
      companion: uniqIds(col.companion ?? []),
      secret: uniqIds(col.secret ?? []),
    },
    achievements: uniqIds(r.achievements ?? []),
    codexRewardClaimed: uniqIds(r.codexRewardClaimed ?? []),
    titles: uniqIds(r.titles ?? []),
    stats: {
      combatsWon: Number(r.stats?.combatsWon) || 0,
      pillsCrafted: Number(r.stats?.pillsCrafted) || 0,
      stonesPeak: Number(r.stats?.stonesPeak) || 0,
      offlineSettled: Number(r.stats?.offlineSettled) || 0,
    },
    lastOnlineAt:
      Number(r.lastOnlineAt) > 0 && Number(r.lastOnlineAt) <= Date.now()
        ? Number(r.lastOnlineAt)
        : Date.now(),
  }
}

/** 从当前角色状态推导可补录的图鉴条目（旧档迁移/读档对齐） */
export function deriveCollectionFromState(s: {
  player: PlayerState | null
  gongfa: { learned: Record<string, unknown> }
  treasures: string[]
  inventory: Record<string, number>
  companion: CompanionState
  towerBest: Record<string, number>
  legacy: LegacyState
}): Partial<CollectionState> {
  const realmIds: string[] = []
  if (s.player) {
    const idx = isAscended(s.player) ? 9 : realmIndex(s.player.realm)
    const best = Math.max(idx, s.legacy.bestRealmIndex)
    for (let i = 0; i <= best; i++) {
      const id = REALM_ORDER[i]
      if (id) realmIds.push(id)
    }
  } else if (s.legacy.bestRealmIndex >= 0) {
    for (let i = 0; i <= s.legacy.bestRealmIndex; i++) {
      const id = REALM_ORDER[i]
      if (id) realmIds.push(id)
    }
  }

  const itemIds = [
    ...Object.keys(s.inventory).filter(
      (id) => id.startsWith('pill_') || id.startsWith('treasure_') || id.startsWith('mat_'),
    ),
    ...s.treasures,
  ]

  const companionIds = Object.entries(s.companion.affinity)
    .filter(([, v]) => v >= 1)
    .map(([id]) => id)
  if (s.companion.spouseId) companionIds.push(s.companion.spouseId)
  for (const [id, n] of Object.entries(s.companion.heartsSeen)) {
    if ((n ?? 0) > 0) companionIds.push(id)
  }
  companionIds.push(...(s.companion.hiddenUnlocked ?? []))
  companionIds.push(...Object.keys(s.companion.endings ?? {}))

  return {
    realm: realmIds,
    gongfa: Object.keys(s.gongfa.learned),
    item: itemIds,
    companion: companionIds,
    secret: Object.keys(s.towerBest),
  }
}

export function mergeCollection(
  base: CollectionState,
  patch: Partial<CollectionState>,
): CollectionState {
  return {
    realm: uniqIds([...base.realm, ...(patch.realm ?? [])]),
    enemy: uniqIds([...base.enemy, ...(patch.enemy ?? [])]),
    gongfa: uniqIds([...base.gongfa, ...(patch.gongfa ?? [])]),
    item: uniqIds([...base.item, ...(patch.item ?? [])]),
    companion: uniqIds([...base.companion, ...(patch.companion ?? [])]),
    secret: uniqIds([...base.secret, ...(patch.secret ?? [])]),
  }
}

export function defaultInventory(): Record<string, number> {
  return { pill_qi: 2, pill_heal: 2 }
}

export function migratePet(raw: unknown): PetState | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<PetState>
  const petId = String(r.petId ?? '')
  if (!petId || !PET_MAP[petId]) return null
  const job = (r.job === 'farm' || r.job === 'guard' ? r.job : 'none') as PetJob
  return {
    petId,
    name: typeof r.name === 'string' && r.name ? r.name : PET_MAP[petId].name,
    level: Math.max(1, Math.min(20, Number(r.level) || 1)),
    exp: Math.max(0, Number(r.exp) || 0),
    bond: Math.max(0, Math.min(100, Number(r.bond) || 0)),
    job,
    jobOn: typeof r.jobOn === 'string' ? r.jobOn : '',
    restUntilDay: Math.max(0, Number(r.restUntilDay) || 0),
    captureFails: Math.max(0, Number(r.captureFails) || 0),
  }
}
