import { ITEMS } from '../../data/items'
import { expNeeded, REALMS, realmLabel, realmMaxEnergy } from '../../data/realms'
import { OFFLINE_PILL_BONUS, formatOfflineDuration } from '../../game/offline'
import { migrateAbode } from '../../game/farm'
import { removeItem } from '../../game/inventory'
import { isAscended } from '../../game/reincarnate'
import { decryptSave, encryptSave } from '../../game/saveCrypto'
import {
  afterProgressSnapshot,
  log,
  playerMaxHpCap,
  processMetaProgress,
  SAVE_PREFIX,
  snapshotOf,
  touchOnline,
  trySettleOffline,
} from '../helpers'
import type { GameState, MetaGet, MetaSet } from '../gameState'
import {
  decryptSnapshotJson,
  deriveCollectionFromState,
  mergeCollection,
  migrateArtifacts,
  migrateCheckin,
  migrateCompanion,
  migrateDaily,
  migrateFavor,
  migrateGongfa,
  migrateLegacy,
  migrateMeta,
  migratePet,
  migrateSect,
  migrateWanted,
  sanitizeInventory,
  sanitizePetCaptureFails,
} from '../saveMigrate'
import { useLogStore } from '../useLogStore'
import type { MetaState, PlayerState, SlotSnapshot } from '../../types'

/** save 域：存档槽/导出导入、在线锚点与离线闭关结算入口 */
export function createSaveSlice(
  set: MetaSet,
  get: MetaGet,
): Pick<
  GameState,
  | 'touchOnline'
  | 'recheckOffline'
  | 'resolveOffline'
  | 'saveToSlot'
  | 'loadFromSlot'
  | 'deleteSlot'
  | 'slotMeta'
  | 'exportSave'
  | 'exportSaveEncrypted'
  | 'importSave'
  | 'importSaveToSlot'
> {
  return {
    touchOnline: () => touchOnline(get, set),
    recheckOffline: () => trySettleOffline(get, set),
    resolveOffline: (mode) => {
      const pending = get().offlinePending
      const { player } = get()
      if (!pending || !player || !player.alive) {
        set({ offlinePending: null })
        return
      }
      let gain = pending.expGain
      let stones = get().stones
      let inv = { ...get().inventory }
      if (mode === 'stone') {
        if (stones < pending.deepenStoneCost || pending.deepenStoneExp <= 0) {
          set({ offlinePending: null })
          return
        }
        stones -= pending.deepenStoneCost
        gain += pending.deepenStoneExp
        log(`灵石加深闭关，花费 ${pending.deepenStoneCost}，额外修为 +${pending.deepenStoneExp}`, 'gold')
      } else if (mode === 'pill') {
        const pillId = pending.pillId
        if (!pillId || (inv[pillId] ?? 0) <= 0 || pending.deepenPillExp <= 0) {
          set({ offlinePending: null })
          return
        }
        removeItem(inv, pillId)
        gain += pending.deepenPillExp
        log(
          `服下${ITEMS[pillId]?.name ?? pillId}加深闭关，额外修为 +${pending.deepenPillExp}（+${Math.round(OFFLINE_PILL_BONUS * 100)}%）`,
          'gold',
        )
      }

      const need = expNeeded(player.realm, player.layer)
      log(
        `闭关归来：离线约 ${formatOfflineDuration(pending.elapsedMs)}，修为 +${gain}（${player.exp + gain}/${need}）。`,
        'good',
      )
      const meta = get().meta
      set({
        offlinePending: null,
        stones,
        inventory: inv,
        player: { ...player, exp: player.exp + gain },
        meta: {
          ...meta,
          lastOnlineAt: Date.now(),
          stats: {
            ...meta.stats,
            offlineSettled: meta.stats.offlineSettled + 1,
            stonesPeak: Math.max(meta.stats.stonesPeak, stones),
          },
        },
      })
      afterProgressSnapshot(get, set)
    },

    saveToSlot: (slot) => {
      const { player } = get()
      if (!player) return false
      try {
        const plain = JSON.stringify(snapshotOf(get()))
        localStorage.setItem(SAVE_PREFIX + slot, encryptSave(plain))
        log(`已存入存档位 ${slot}。`, 'gold')
        return true
      } catch (e) {
        console.warn(e)
        log('存档失败：本地存储不可用。', 'bad')
        return false
      }
    },

    loadFromSlot: (slot) => {
      try {
        const raw = localStorage.getItem(SAVE_PREFIX + slot)
        if (!raw) {
          log('该存档位为空。', 'bad')
          return false
        }
        const snap = decryptSnapshotJson(raw)
        if (!snap) {
          // decryptSnapshotJson 返回 null：解密失败且非明文 JSON，或缺 player 字段
          log('存档为空或不是有效的问道存档。', 'bad')
          return false
        }
        useLogStore.getState().clear()
        log(
          `读取存档位 ${slot}：${snap.player.name} · ${realmLabel(snap.player.realm, snap.player.layer)}`,
          'gold',
        )
        const migratedSect = migrateSect(snap.sect)
        const migratedGongfa = migrateGongfa(snap.gongfa, migratedSect.learned)
        migratedSect.learned = []
        const maxHp = Math.max(
          snap.player.maxHp,
          playerMaxHpCap(get, snap.player, snap.treasures ?? [], migratedGongfa.learned, snap.legacy?.daoMarks ?? 0, get().player?.realm),
        )
        const maxEnergy = Math.max(
          snap.player.maxEnergy,
          realmMaxEnergy(snap.player.realm, snap.player.classId === 'demon', snap.player.layer),
        )
        const lifespanFloor = REALMS[snap.player.realm]?.lifespan ?? REALMS.qi.lifespan
        const wasFullHp = snap.player.hp >= snap.player.maxHp - 1
        const wasFullEn = snap.player.energy >= snap.player.maxEnergy - 1
        const legacy = migrateLegacy(snap.legacy)
        const companion = migrateCompanion(snap.companion)
        const pet = migratePet((snap as { pet?: unknown }).pet)
        const inventory = sanitizeInventory(snap.inventory)
        const treasures = snap.treasures ?? []
        const towerBest = snap.towerBest ?? {}
        // 旧档：境界已是飞升则补写 ascended，避免「已飞升却走道消」
        const rawPlayer = snap.player
        const playerFixed: PlayerState = isAscended(rawPlayer)
          ? {
              ...rawPlayer,
              ascended: true,
              alive: true,
              lifespanLeft: Math.max(
                rawPlayer.lifespanLeft,
                Math.floor(REALMS.ascended.lifespan * 1),
              ),
            }
          : rawPlayer
        const derived = deriveCollectionFromState({
          player: playerFixed,
          gongfa: migratedGongfa,
          treasures,
          inventory,
          companion,
          towerBest,
          legacy,
        })
        const migratedMeta = migrateMeta(snap.meta)
        const meta: MetaState = {
          ...migratedMeta,
          collection: mergeCollection(migratedMeta.collection, derived),
          // 旧档首次带入 meta：不倒扣离线收益，锚点重置为现在
          lastOnlineAt: snap.meta?.lastOnlineAt && snap.meta.lastOnlineAt <= Date.now()
            ? snap.meta.lastOnlineAt
            : Date.now(),
        }
        set({
          phase: 'play',
          time: snap.time,
          player: {
            ...playerFixed,
            maxHp,
            maxEnergy,
            // 曲线调整后：原先满血/满灵的角色读档即按新上限回满
            hp: wasFullHp ? maxHp : Math.min(maxHp, playerFixed.hp),
            energy: wasFullEn ? maxEnergy : Math.min(maxEnergy, playerFixed.energy),
            lifespanLeft: isAscended(playerFixed)
              ? playerFixed.lifespanLeft
              : Math.max(playerFixed.lifespanLeft, Math.floor(lifespanFloor * 0.3)),
          },
          stones: snap.stones,
          inventory,
          sect: migratedSect,
          treasures,
          artifacts: migrateArtifacts(snap.artifacts, treasures),
          companion,
          pet,
          petCaptureFails: sanitizePetCaptureFails(snap.petCaptureFails),
          gongfa: migratedGongfa,
          towerBest,
          abode: migrateAbode(snap.abode),
          legacy,
          meta,
          daily: migrateDaily((snap as { daily?: unknown }).daily),
          checkin: migrateCheckin((snap as { checkin?: unknown }).checkin),
          wanted: migrateWanted((snap as { wanted?: unknown }).wanted),
          favor: migrateFavor((snap as { favor?: unknown }).favor),
          offlinePending: null,
          tower: null,
          lastCombat: null,
          pendingEvent: null,
          pendingStory: null,
          activeCombat: null,
          activePanel: 'cultivate',
        })
        processMetaProgress(get, set)
        trySettleOffline(get, set)
        return true
      } catch (e) {
        console.warn(e)
        log('读档失败：存档已损坏或密钥不匹配。', 'bad')
        return false
      }
    },

    deleteSlot: (slot) => {
      try {
        localStorage.removeItem(SAVE_PREFIX + slot)
      } catch (e) {
        console.warn(e)
        log('删除存档失败：本地存储不可用。', 'bad')
      }
    },

    slotMeta: (slot) => {
      try {
        const raw = localStorage.getItem(SAVE_PREFIX + slot)
        if (!raw) {
          return { index: slot, name: '', realmLabel: '', year: 0, updatedAt: 0, empty: true }
        }
        const json = decryptSave(raw) ?? (raw.startsWith('{') ? raw : null)
        if (!json) {
          return { index: slot, name: '', realmLabel: '', year: 0, updatedAt: 0, empty: true }
        }
        const snap = JSON.parse(json) as SlotSnapshot
        return {
          index: slot,
          name: snap.player.name,
          realmLabel: realmLabel(snap.player.realm, snap.player.layer),
          year: snap.time.year,
          updatedAt: snap.updatedAt,
          empty: false,
        }
      } catch (e) {
        console.warn(e)
        return { index: slot, name: '', realmLabel: '', year: 0, updatedAt: 0, empty: true }
      }
    },

    exportSave: () => {
      const { player } = get()
      if (!player) return ''
      return JSON.stringify(snapshotOf(get()))
    },

    exportSaveEncrypted: () => {
      const { player } = get()
      if (!player) throw new Error('NO_PLAYER')
      return encryptSave(JSON.stringify(snapshotOf(get())))
    },

    importSave: (payload) => {
      try {
        const snap = decryptSnapshotJson(payload)
        if (!snap?.player.name) return false
        const migratedSect = migrateSect(snap.sect)
        const migratedGongfa = migrateGongfa(snap.gongfa, migratedSect.learned)
        migratedSect.learned = []
        const companion = migrateCompanion(snap.companion)
        const pet = migratePet((snap as { pet?: unknown }).pet)
        const inventory = sanitizeInventory(snap.inventory ?? {})
        const treasures = snap.treasures ?? []
        const towerBest = snap.towerBest ?? {}
        const legacy = migrateLegacy(snap.legacy)
        const playerFixed: PlayerState = isAscended(snap.player)
          ? {
              ...snap.player,
              ascended: true,
              alive: true,
              lifespanLeft: Math.max(
                snap.player.lifespanLeft,
                Math.floor(REALMS.ascended.lifespan),
              ),
            }
          : snap.player
        const derived = deriveCollectionFromState({
          player: playerFixed,
          gongfa: migratedGongfa,
          treasures,
          inventory,
          companion,
          towerBest,
          legacy,
        })
        const migratedMeta = migrateMeta(snap.meta)
        const meta: MetaState = {
          ...migratedMeta,
          collection: mergeCollection(migratedMeta.collection, derived),
          lastOnlineAt:
            snap.meta?.lastOnlineAt && snap.meta.lastOnlineAt <= Date.now()
              ? snap.meta.lastOnlineAt
              : Date.now(),
        }
        set({
          phase: 'play',
          time: snap.time,
          player: playerFixed,
          stones: snap.stones ?? 0,
          inventory,
          sect: migratedSect,
          treasures,
          artifacts: migrateArtifacts(snap.artifacts, treasures),
          companion,
          pet,
          petCaptureFails: sanitizePetCaptureFails(snap.petCaptureFails),
          gongfa: migratedGongfa,
          towerBest,
          abode: migrateAbode(snap.abode),
          legacy,
          meta,
          daily: migrateDaily((snap as { daily?: unknown }).daily),
          checkin: migrateCheckin((snap as { checkin?: unknown }).checkin),
          wanted: migrateWanted((snap as { wanted?: unknown }).wanted),
          favor: migrateFavor((snap as { favor?: unknown }).favor),
          offlinePending: null,
          tower: null,
          lastCombat: null,
          pendingEvent: null,
          pendingStory: null,
          activeCombat: null,
        })
        processMetaProgress(get, set)
        trySettleOffline(get, set)
        log('存档导入成功。', 'gold')
        return true
      } catch (e) {
        console.warn(e)
        log('导入失败：存档文件已损坏。', 'bad')
        return false
      }
    },

    importSaveToSlot: (slot, fileContent) => {
      if (slot < 0 || slot > 3) return false
      try {
        let json = fileContent.trim()
        const decrypted = decryptSave(json)
        if (decrypted) json = decrypted
        else if (!json.startsWith('{')) {
          log('导入失败：不是有效的问道存档文件。', 'bad')
          return false
        }
        const snap = JSON.parse(json) as SlotSnapshot
        if (!snap?.player?.name) {
          log('导入失败：存档为空或不是有效的问道存档。', 'bad')
          return false
        }
        // 统一存为密文
        localStorage.setItem(SAVE_PREFIX + slot, encryptSave(json))
        return true
      } catch (e) {
        console.warn(e)
        log('导入失败：存档文件已损坏。', 'bad')
        return false
      }
    },
  }
}
