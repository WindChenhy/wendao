import { create } from 'zustand'
import { dayNumber } from '../game/day'
import { freshAbode } from '../game/farm'
import { loadGameSettings } from '../game/settings'
import type { GameState } from './gameState'
import { runPetFarmAssist } from './helpers'
import { defaultInventory, freshCompanion, freshGongfa, freshLegacy, freshMeta, freshSect } from './saveMigrate'
import { createAbodeSlice } from './slices/abodeSlice'
import { createCombatSlice } from './slices/combatSlice'
import { createCompanionSlice } from './slices/companionSlice'
import { createCultivateSlice } from './slices/cultivateSlice'
import { createExploreSlice } from './slices/exploreSlice'
import { createInventorySlice } from './slices/inventorySlice'
import { createMetaSlice } from './slices/metaSlice'
import { createPetSlice } from './slices/petSlice'
import { createSaveSlice } from './slices/saveSlice'
import { createSectSlice } from './slices/sectSlice'

export { gongfaBonuses, treasureBonus, artifactBattleExtras, treasureBreakthroughTotal } from '../game/combatStats'

/**
 * 组合点：初始 state 在此一次成文，各领域 action 由 src/stores/slices/* 提供。
 * 拆分为 zustand slices 模式（纯机械搬移，action 名与行为与单文件版本完全一致）。
 */
export const useGameStore = create<GameState>((set, get) => ({
  phase: 'menu',
  time: { year: 1, month: 1, day: 1 },
  player: null,
  stones: 80,
  inventory: defaultInventory(),
  sect: freshSect(),
  treasures: [],
  artifacts: [],
  companion: freshCompanion(),
  gongfa: freshGongfa(),
  towerBest: {},
  tower: null,
  abode: freshAbode(),
  legacy: freshLegacy(),
  meta: freshMeta(),
  pet: null,
  petCaptureFails: 0,
  offlinePending: null,
  activePanel: 'cultivate',
  exploring: false,
  lastCombat: null,
  pendingEvent: null,
  pendingStory: null,
  activeCombat: null,
  /** 新战斗按设置决定是否托管；战斗面板先渲染出来，灵力与存档对齐 */
  autoCombat: loadGameSettings().autoCombatDefault,
  skipExploreCombat: loadGameSettings().skipExploreCombat,
  autoCombatDefault: loadGameSettings().autoCombatDefault,

  ...createMetaSlice(set, get),
  ...createCultivateSlice(set, get),
  ...createExploreSlice(set, get),
  ...createCombatSlice(set, get),
  ...createSectSlice(set, get),
  ...createAbodeSlice(set, get),
  ...createPetSlice(set, get),
  ...createCompanionSlice(set, get),
  ...createInventorySlice(set, get),
  ...createSaveSlice(set, get),
}))

// v1.2 灵兽灵田协助：跨日自动结算（岗位为「灵田协助」时，无需手动点击）
{
  let lastDay = dayNumber(useGameStore.getState().time)
  useGameStore.subscribe((state, prev) => {
    if (state.time === prev.time) return
    const d = dayNumber(state.time)
    if (d === lastDay) return
    lastDay = d
    const snapshot = useGameStore.getState()
    if (!snapshot.player || !snapshot.player.alive) return
    if (snapshot.pet?.job !== 'farm' || snapshot.pet.jobOn === String(d)) return
    runPetFarmAssist(useGameStore.getState, useGameStore.setState, { auto: true })
  })
}
