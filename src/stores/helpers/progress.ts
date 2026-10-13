import {
  ACHIEVEMENT_MAP,
  ACHIEVEMENT_DAO_CAP,
  describeReward as describeAchieveReward,
  evaluateAchievementIds,
  grantAchievementDaoMarks,
} from '../../data/achievements'
import { julingCultivateBonus } from '../../data/abode'
import type { PathInput } from '../../data/classes'
import { pathIdsOf } from '../../data/classes'
import {
  CODEX_PAGE_META,
  codexRewardKey,
  pendingCodexRewards,
  describeCodexReward,
} from '../../data/codex'
import { ITEMS } from '../../data/items'
import { SECT_RANKS } from '../../data/sects'
import { buildingCultivateMul } from '../../data/sectBuildings'
import { cultivateGain, seclusionGain } from '../../game/day'
import { gongfaBonuses, treasureBonus } from '../../game/combatStats'
import { daoBonuses, isAscended } from '../../game/reincarnate'
import {
  OFFLINE_PILL_IDS,
  calcOfflineCultivation,
  type OfflineSettlement,
} from '../../game/offline'
import type {
  CodexPageId,
  CompanionState,
  GongfaLearned,
  OfflinePending,
  PlayerState,
  SectState,
} from '../../types'
import type { MetaGet, MetaSet } from '../gameState'
import { deriveCollectionFromState, mergeCollection, uniqIds } from '../saveMigrate'
import { log } from './log'
import { currentRules, sectDef, spouseDef } from './shared'

export function gainCultivate(
  paths: PathInput,
  realm: PlayerState['realm'],
  layer: number,
  julingLevel = 0,
): number {
  return Math.floor(cultivateGain(paths, realm, layer) * currentRules().cultivateMul * julingCultivateBonus(julingLevel))
}

export function gainSeclusion(
  paths: PathInput,
  realm: PlayerState['realm'],
  layer: number,
  days: number,
  julingLevel = 0,
): number {
  return Math.floor(seclusionGain(paths, realm, layer, days) * currentRules().cultivateMul * julingCultivateBonus(julingLevel))
}

/** 合并修炼倍率：道痕 / 宗门 / 职位 / 功法 / 道侣 / 法宝（打坐/闭关/双修/离线共用）。
 *  全局规则倍率 currentRules().cultivateMul 不在此处：它已并入 gainCultivate/gainSeclusion。 */
export function cultivateMultipliers(
  player: PlayerState | null,
  sect: SectState,
  companion: CompanionState,
  gongfaLearned: Record<string, GongfaLearned>,
  daoMarks: number,
  treasures: string[] = [],
): number {
  if (!player) return 1
  const sdef = sectDef(sect.sectId)
  const rankBonus = SECT_RANKS[sect.rank]?.cultivateMul ?? 1
  const gongfaMul = gongfaBonuses(gongfaLearned, player.realm).cultivate * buildingCultivateMul(sect.buildings)
  const spouse = spouseDef(companion)
  const dao = daoBonuses(daoMarks)
  const treasureMul = treasureBonus(treasures).cultivate
  return (
    dao.cultivateMul *
    (sdef?.bonus.cultivateMul ?? 1) *
    rankBonus *
    gongfaMul *
    (spouse ? 1 + (spouse.dualMul - 1) * 0.35 : 1) *
    treasureMul
  )
}

/** 记录图鉴条目；若有新解锁则继续跑图鉴奖励与成就 */
export function unlockCodex(get: MetaGet, set: MetaSet, page: CodexPageId, id: string) {
  if (!id) return
  const meta = get().meta
  if (meta.collection[page]?.includes(id)) return
  const collection = {
    ...meta.collection,
    [page]: [...(meta.collection[page] ?? []), id],
  }
  const pageMeta = CODEX_PAGE_META[page]
  log(`图鉴收录：「${pageMeta.name}」新条目。`, 'dim')
  set({ meta: { ...meta, collection } })
  processMetaProgress(get, set)
}

/** 结算图鉴节点奖励与新达成的成就（自动入账 + 日志） */
export function processMetaProgress(get: MetaGet, set: MetaSet) {
  const state = get()
  const meta = state.meta
  let stones = state.stones
  let legacy = state.legacy
  let claimed = [...meta.codexRewardClaimed]
  let titles = [...meta.titles]
  let achievements = [...meta.achievements]
  let stats = { ...meta.stats, stonesPeak: Math.max(meta.stats.stonesPeak, stones) }

  const codexHits = pendingCodexRewards(meta.collection, claimed)
  for (const hit of codexHits) {
    claimed.push(codexRewardKey(hit.page, hit.pct))
    if (hit.reward.stones) stones += hit.reward.stones
    if (hit.reward.daoMarks) {
      legacy = { ...legacy, daoMarks: legacy.daoMarks + hit.reward.daoMarks }
    }
    if (hit.reward.title && !titles.includes(hit.reward.title)) {
      titles.push(hit.reward.title)
    }
    log(
      `图鉴「${CODEX_PAGE_META[hit.page].name}」达成 ${hit.pct}%：${describeCodexReward(hit.reward)}`,
      'gold',
    )
  }

  const progressIds = evaluateAchievementIds({
    player: state.player,
    legacy,
    stones,
    gongfaCount: Object.keys(state.gongfa.learned).length,
    treasureCount: state.treasures.length,
    companion: state.companion,
    sect: state.sect,
    towerBest: state.towerBest,
    collection: meta.collection,
    stats,
    favor: state.favor,
    enabledDlc: currentRules().enabledIds,
    wanted: state.wanted,
    pet: state.pet
      ? { level: state.pet.level, broken: state.pet.broken, bond: state.pet.bond }
      : null,
    pathCount: state.player ? pathIdsOf(state.player).length : 0,
  })

  const unlockedSet = new Set(achievements)
  for (const id of progressIds) {
    if (unlockedSet.has(id)) continue
    const def = ACHIEVEMENT_MAP[id]
    if (!def) continue
    if (def.reward.stones) stones += def.reward.stones
    let rewardText = describeAchieveReward(def.reward)
    if (def.reward.daoMarks) {
      // R-12：成就道痕单世软上限，溢出折算当世灵石
      const split = grantAchievementDaoMarks(achievements, def.reward.daoMarks)
      if (split.daoMarks > 0) legacy = { ...legacy, daoMarks: legacy.daoMarks + split.daoMarks }
      if (split.stones > 0) {
        stones += split.stones
        const overflow = def.reward.daoMarks - split.daoMarks
        rewardText += `（单世道痕上限 ${ACHIEVEMENT_DAO_CAP}，溢出 ${overflow} 点折算灵石 +${split.stones}）`
      }
    }
    if (def.reward.title && !titles.includes(def.reward.title)) {
      titles.push(def.reward.title)
    }
    achievements.push(id)
    unlockedSet.add(id)
    log(`成就解锁「${def.name}」：${def.desc} · ${rewardText}`, 'gold')
  }

  set({
    stones,
    legacy,
    meta: {
      ...meta,
      achievements: uniqIds(achievements),
      codexRewardClaimed: claimed,
      titles,
      stats,
    },
  })
}

/** 触达图鉴/成就的通用入口（战斗获胜、获得物品等之后调用） */
export function afterProgressSnapshot(get: MetaGet, set: MetaSet) {
  const state = get()
  if (!state.player) return
  const derived = deriveCollectionFromState(state)
  const collection = mergeCollection(state.meta.collection, derived)
  const stats = {
    ...state.meta.stats,
    stonesPeak: Math.max(state.meta.stats.stonesPeak, state.stones),
  }
  if (
    collection.realm.length !== state.meta.collection.realm.length ||
    collection.gongfa.length !== state.meta.collection.gongfa.length ||
    collection.item.length !== state.meta.collection.item.length ||
    collection.companion.length !== state.meta.collection.companion.length ||
    collection.secret.length !== state.meta.collection.secret.length ||
    stats.stonesPeak !== state.meta.stats.stonesPeak
  ) {
    set({ meta: { ...state.meta, collection, stats } })
  }
  processMetaProgress(get, set)
}

function pickOfflinePill(inventory: Record<string, number>): { id: string; name: string } | null {
  for (const id of OFFLINE_PILL_IDS) {
    if ((inventory[id] ?? 0) > 0) {
      return { id, name: ITEMS[id]?.name ?? id }
    }
  }
  return null
}

function buildOfflinePending(get: MetaGet, settlement: OfflineSettlement): OfflinePending | null {
  const state = get()
  if (!state.player || !settlement.active) return null
  const pill = pickOfflinePill(state.inventory)
  return {
    ...settlement,
    stones: state.stones,
    pillId: pill?.id ?? null,
    pillName: pill?.name ?? '无可用丹药',
  }
}

/** 计算并挂起离线闭关结算（读档/回前台时调用） */
export function trySettleOffline(get: MetaGet, set: MetaSet) {
  if (get().offlinePending) return
  const state = get()
  const player = state.player
  if (!player || !player.alive || isAscended(player)) return
  const settlement = calcOfflineCultivation({
    lastOnlineAt: state.meta.lastOnlineAt,
    now: Date.now(),
    classId: player.classId,
    paths: player.paths,
    aptitude: player.aptitude,
    realm: player.realm,
    layer: player.layer,
    multipliers: cultivateMultipliers(
      player,
      state.sect,
      state.companion,
      state.gongfa.learned,
      state.legacy.daoMarks,
      state.treasures,
    ) * currentRules().cultivateMul * julingCultivateBonus(state.abode.julingLevel),
  })
  if (settlement.reason === 'clock_backward') {
    log('检测到时间异常，离线修炼未结算。已重置在线锚点。', 'bad')
    set({ meta: { ...state.meta, lastOnlineAt: Date.now() } })
    return
  }
  if (!settlement.active) return
  const pending = buildOfflinePending(get, settlement)
  if (!pending) return
  set({ offlinePending: pending })
}
