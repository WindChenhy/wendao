import { ARTIFACT_RECIPES } from '../../data/artifacts'
import { SEEDS } from '../../data/abode'
import {
  companionById,
  nextStoryBeat,
  type CompanionDef,
} from '../../data/companions'
import {
  pickWorldEvent,
  type EventGateContext,
  type WorldEvent,
} from '../../data/events'
import { PET_FARM_ASSIST_MUL } from '../../data/pets'
import { questChainById } from '../../data/sectQuests'
import { SECTS, type SectDef } from '../../data/sects'
import { BUILTIN_DLC } from '../../dlc/builtin'
import { combineRules, loadEnabledDlc, type RuntimeRules } from '../../dlc/types'
import { dayNumber } from '../../game/day'
import { resolveAlignment } from '../../game/reputation'
import { harvestYield, plotProgress } from '../../game/farm'
import { addItem } from '../../game/inventory'
import type { CompanionState, GameTime, PlayerState, SectState } from '../../types'
import type { MetaGet, MetaSet } from '../gameState'
import { log } from './log'

/** 运行时规则缓存：按「已启用 DLC id」为键，避免渲染期反复合并全部数据包（P2-1） */
let rulesCache: { key: string; rules: RuntimeRules } | null = null

export function currentRules(): RuntimeRules {
  const ids = loadEnabledDlc()
  const key = ids.join('|')
  if (rulesCache?.key !== key) {
    rulesCache = { key, rules: combineRules(BUILTIN_DLC, ids) }
  }
  return rulesCache.rules
}

/** 打造法宝所需天数（配方缺省 2 日） */
export function artifactCraftDays(recipeId: string): number {
  return ARTIFACT_RECIPES.find((r) => r.id === recipeId)?.craftDays ?? 2
}

export function spouseDef(companion: CompanionState): CompanionDef | null {
  if (!companion.spouseId) return null
  return companionById(companion.spouseId) ?? null
}

export function sectDef(id: string | null): SectDef | null {
  if (!id) return null
  return SECTS.find((s) => s.id === id) ?? null
}

function buildEventContext(s: {
  player: PlayerState | null
  time: GameTime
  sect: SectState
  companion: CompanionState
  wanted?: number
}): EventGateContext | null {
  const p = s.player
  if (!p) return null
  return {
    realm: p.realm,
    layer: p.layer,
    classId: p.classId,
    paths: p.paths,
    year: s.time.year,
    repRight: p.repRight,
    repDemonic: p.repDemonic,
    sectId: s.sect.sectId,
    sectRank: s.sect.rank,
    spouseId: s.companion.spouseId,
    affinity: s.companion.affinity,
    flags: s.companion.flags,
    wanted: s.wanted ?? 0,
    // R-31：立场独立字段（显式或由双声望推导）
    alignment: resolveAlignment(p),
  }
}

export function pickEvent(get: MetaGet): WorldEvent | null {
  const s = get()
  const ctx = buildEventContext(s)
  if (!ctx) return null
  const rules = currentRules()
  return pickWorldEvent(ctx, rules.extraEvents, rules.enabledIds)
}

/** 任务链：历练/秘境获胜推进 explore_win 步骤 */
export function bumpQuestExploreWin(get: MetaGet, set: MetaSet) {
  const { sect } = get()
  if (!sect.sectId || !sect.quest) return
  const chain = questChainById(sect.quest.chainId)
  if (!chain) return
  const step = chain.steps[sect.quest.stepIndex]
  if (!step || step.type !== 'explore_win') return
  const need = step.count ?? 1
  const progress = sect.quest.progress + 1
  if (progress >= need) {
    set({
      sect: {
        ...sect,
        quest: {
          ...sect.quest,
          stepIndex: sect.quest.stepIndex + 1,
          progress: 0,
          completedSteps: sect.quest.completedSteps + 1,
        },
      },
    })
    log(`任务链「${chain.name}」：${step.desc} —— 已完成。`, 'good')
  } else {
    set({ sect: { ...sect, quest: { ...sect.quest, progress } } })
    log(`任务链「${chain.name}」：${step.desc}（${progress}/${need}）`, 'dim')
  }
}

/** 结缘后剧情：有可触发段则弹出（身份/时序门槛由 nextStoryBeat 处理，命中的可能是替代段） */
export function maybeTriggerSpouseStory(get: MetaGet, set: MetaSet) {
  const s = get()
  if (!s.player || s.pendingEvent || s.pendingStory || s.activeCombat) return
  const spouseId = s.companion.spouseId
  if (!spouseId) return
  const c = companionById(spouseId)
  if (!c?.postStory?.length) return
  const stage = s.companion.postStage[spouseId] ?? 0
  const next = nextStoryBeat(c, stage, {
    realm: s.player.realm,
    sectId: s.sect.sectId,
    sectRank: s.sect.rank,
    flags: s.companion.flags,
  })
  for (const text of next.skipped) log(text, 'dim')
  if (!next.beat) {
    // 剩余段落全部被门槛略过：一次性推进到结尾，避免每回合重复扫描
    if (next.index !== stage) {
      set({
        companion: {
          ...s.companion,
          postStage: { ...s.companion.postStage, [spouseId]: next.index },
        },
      })
    }
    return
  }
  set({ pendingStory: { companionId: spouseId, beat: next.beat, beatIndex: next.index } })
}

/** v1.2 灵兽灵田协助（手动按钮 / 跨日自动共用）；auto 模式下无可收获则不消耗当日协助 */
export function runPetFarmAssist(
  get: MetaGet,
  set: MetaSet,
  opts: { auto: boolean },
) {
  const { pet, abode, inventory, time } = get()
  if (!pet || pet.job !== 'farm') return
  const day = String(dayNumber(time))
  if (pet.jobOn === day) {
    if (!opts.auto) log('灵兽今日已协助。', 'dim')
    return
  }
  const inv = { ...inventory }
  let harvested = 0
  const plots = abode.plots.map((plot) => {
    const prog = plotProgress(plot, time)
    if (!plot.seedId || !prog.ready || Math.random() > PET_FARM_ASSIST_MUL * 2) return plot
    const seed = SEEDS[plot.seedId]
    if (!seed) return { seedId: null, plantedDay: 0 }
    const n = Math.max(1, Math.floor(harvestYield(plot.seedId) * 0.5))
    addItem(inv, seed.yieldItemId, n)
    harvested += n
    return { seedId: null, plantedDay: 0 }
  })
  if (opts.auto && harvested === 0) return
  log(pet.name + (opts.auto ? ' 自行协助灵田，收获 ' : ' 协助灵田，收获 ') + harvested + '（不增修为）。', 'good')
  set({
    inventory: inv,
    abode: { ...abode, plots },
    pet: { ...pet, jobOn: day, bond: Math.min(100, pet.bond + 1) },
  })
}
