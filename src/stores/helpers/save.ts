import { TUNING } from '../../game/tuning'
import type { GameState, MetaGet, MetaSet } from '../gameState'
import type { SlotSnapshot } from '../../types'

export const SAVE_PREFIX = 'wendao-slot-'
const SAVE_VERSION = TUNING.saveVersion

export function touchOnline(get: MetaGet, set: MetaSet) {
  const meta = get().meta
  set({ meta: { ...meta, lastOnlineAt: Date.now() } })
}

export function snapshotOf(s: GameState): SlotSnapshot {
  return {
    version: SAVE_VERSION,
    time: s.time,
    player: s.player!,
    stones: s.stones,
    inventory: s.inventory,
    sect: s.sect,
    treasures: s.treasures,
    artifacts: s.artifacts,
    companion: s.companion,
    gongfa: s.gongfa,
    towerBest: s.towerBest,
    abode: s.abode,
    legacy: s.legacy,
    meta: { ...s.meta, lastOnlineAt: Date.now() },
    pet: s.pet,
    updatedAt: Date.now(),
  }
}
