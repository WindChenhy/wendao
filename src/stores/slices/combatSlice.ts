import { COMBAT_CONFIG } from '../../data/skills'
import {
  canPaySkill,
  defaultAutoAction,
  getUnlockedPlayerSkills,
  stepCombat,
  type CombatEngineState,
} from '../../game/combatEngine'
import { applyCombatConsumables, settleActiveCombat } from '../helpers'
import type { GameState, MetaGet, MetaSet } from '../gameState'

/** combat 域：回合制战斗引擎交互（combatAct/托管/自动打完） */
export function createCombatSlice(
  set: MetaSet,
  get: MetaGet,
): Pick<
  GameState,
  'toggleCombatAuto' | 'combatAct' | 'runCombatAutoToEnd'
> {
  return {
    toggleCombatAuto: () => {
      set({ autoCombat: !get().autoCombat })
    },

    combatAct: (action) => {
      const { activeCombat, player, inventory } = get()
      if (!activeCombat || activeCombat.finished || !player) return

      let inv = inventory
      if (action.type === 'potion') {
        if ((inv[action.itemId] ?? 0) <= 0) return
      }
      if (action.type === 'skill') {
        const skills = getUnlockedPlayerSkills(player.classId, player.realm, player.layer)
        const sk = skills.find((s) => s.id === action.skillId)
        if (!sk || !canPaySkill(activeCombat, sk)) return
      }

      const state = stepCombat(activeCombat, action, inv, player.realm, player.layer)
      // 深拷贝一层，确保 zustand 能触发 React 更新
      const next: CombatEngineState = {
        ...state,
        player: { ...state.player, statuses: state.player.statuses.map((s) => ({ ...s })), skillCd: { ...state.player.skillCd } },
        enemy: { ...state.enemy, statuses: state.enemy.statuses.map((s) => ({ ...s })), skillCd: { ...state.enemy.skillCd } },
        log: [...state.log],
      }
      // 灵力实时回写存档（战斗结算时再统一写回气血等；气血可能经环境压缩，勿在此写）
      const syncedEnergy = Math.max(0, Math.min(player.maxEnergy, next.player.energy))
      set({
        activeCombat: next,
        player: { ...player, energy: syncedEnergy },
      })

      if (next.finished) {
        settleActiveCombat(get, set)
      }
    },

    runCombatAutoToEnd: () => {
      const { activeCombat, player, inventory } = get()
      if (!activeCombat || activeCombat.finished || !player) return
      let state: CombatEngineState = activeCombat
      let inv = inventory
      const cfg = COMBAT_CONFIG
      let guard = 0
      while (!state.finished && guard < cfg.maxRounds + 8) {
        guard += 1
        const action = defaultAutoAction(state, inv, player.realm, player.layer)
        if (action.type === 'potion' && (inv[action.itemId] ?? 0) <= 0) {
          state = stepCombat(state, { type: 'attack' }, inv, player.realm, player.layer)
        } else {
          state = stepCombat(state, action, inv, player.realm, player.layer)
        }
        inv = applyCombatConsumables(state, inv)
        state = { ...state, potionsUsed: [], blastPillsUsed: [] }
      }
      const syncedEnergy = Math.max(0, Math.min(player.maxEnergy, state.player.energy))
      set({
        activeCombat: {
          ...state,
          player: { ...state.player, statuses: [...state.player.statuses] },
          enemy: { ...state.enemy, statuses: [...state.enemy.statuses] },
          log: [...state.log],
        },
        inventory: inv,
        player: get().player ? { ...get().player!, energy: syncedEnergy } : player,
      })
      if (state.finished) settleActiveCombat(get, set)
    },
  }
}
