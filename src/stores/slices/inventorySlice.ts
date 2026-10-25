import {
  createArtifactInstance,
  type ArtifactQuality,
} from '../../data/artifacts'
import { isDemonic } from '../../data/classes'
import {
  GONGFA_STAGE_LABELS,
  GONGFAS,
  gongfaAdvanceCost,
  gongfaByScrollId,
  isMarketGongfa,
  canLearnGongfaFull,
  gongfaScopeText,
  gongfaRealmText,
} from '../../data/gongfa'
import {
  ITEMS,
  consumableExpGain,
  itemCategory,
  itemEffectWithMarks,
  itemMinRealmOk,
  itemOverScope,
  itemScopeText,
  itemTierText,
} from '../../data/items'
import { ASCENSION_REALM, REALMS } from '../../data/realms'
import { SHAQI_CLEANSE } from '../../data/shaqi'
import { addItem, removeItem } from '../../game/inventory'
import { marketPriceOf } from '../../game/bounty'
import {
  CLEANSE_PILL_HEART_DEMON,
  adjustHeartDemon,
} from '../../game/heartDemon'
import { TUNING } from '../../game/tuning'
import {
  afterProgressSnapshot,
  log,
  recomputeVitals,
  unlockCodex,
} from '../helpers'
import type { GameState, MetaGet, MetaSet } from '../gameState'

/** inventory 域：物品使用/买卖、功法秘籍参悟与进阶 */
export function createInventorySlice(
  set: MetaSet,
  get: MetaGet,
): Pick<
  GameState,
  'useItem' | 'comprehendGongfa' | 'advanceGongfaStage' | 'sellItem' | 'buyItem'
> {
  return {
    useItem: (id) => {
      const { player, inventory } = get()
      if (!player || !player.alive) return
      const count = inventory[id] ?? 0
      const item = ITEMS[id]
      if (count <= 0 || !item?.effect) return
      // 突破辅助丹药：冲击壁垒时自动选用并消耗，不可提前服用
      if (item.effect.breakthroughRate && !item.effect.hp && !item.effect.exp && !item.effect.energy) {
        log(`「${item.name}」将在冲击壁垒时自动服用（成功率 +${item.effect.breakthroughRate}%）。`, 'dim')
        return
      }
      // 起步境界门槛
      if (!itemMinRealmOk(item, player.realm)) {
        const lo = item.minRealm ? REALMS[item.minRealm]?.name ?? item.minRealm : ''
        log(`境界不足：「${item.name}」需${lo}以上方可服用。`, 'bad')
        return
      }
      const over = itemOverScope(item, player.realm)
      const eff = itemEffectWithMarks(item)
      const inv = { ...inventory }
      removeItem(inv, id)
      const p = { ...player }
      const markNote = (item.danMarks ?? 0) > 0 ? `（${item.danMarks}纹药力）` : ''
      const scopeNote = over ? '（已超适用范围，药效大减）' : ''
      const scopeMul = over ? TUNING.overScopeEfficiency : 1
      // 特殊功效
      if (eff.special === 'full_heal') {
        p.hp = p.maxHp
        p.energy = p.maxEnergy
      }
      if (eff.special === 'cleanse') {
        if (isDemonic(p) && p.shaqi > 0) {
          p.shaqi = Math.max(0, p.shaqi - SHAQI_CLEANSE)
        }
        // R-24：清心丹亦化解心魔（−15），此为心魔两大常规削减手段之一
        if ((p.heartDemon ?? 0) > 0) {
          const before = p.heartDemon ?? 0
          p.heartDemon = adjustHeartDemon(before, -CLEANSE_PILL_HEART_DEMON)
          log(`清心丹药力化开，心魔杂念为之一清（心魔 -${before - (p.heartDemon ?? 0)}）。`, 'good')
        }
      }
      if (eff.hp) {
        const h = Math.floor(eff.hp * scopeMul)
        p.hp = Math.min(p.maxHp, p.hp + h)
      }
      if (eff.energy) {
        p.energy = Math.min(p.maxEnergy, p.energy + Math.floor(eff.energy * scopeMul))
      }
      if (eff.stone) {
        // 由 useItem 外层 stones 更新
      }
      if (eff.exp) {
        // v1.5（R-03）：修为丹只有一套口径（见 items.ts 的 consumableExpGain）
        // 飞升后修为需求恒为 0，修为奖励无处可去，转而记入日志（并保留 favor 通道）
        const gain = player.realm === ASCENSION_REALM ? 0 : consumableExpGain(item, player.realm)
        if (gain > 0) {
          p.exp += gain
          log(`服用 ${item.name}${markNote}，修为 +${gain}${scopeNote}`, 'good')
        } else {
          log(`服用 ${item.name}${markNote}，修为已满，药力尽数化入仙缘。`, 'dim')
        }
      }
      // 仙缘（飞升后的长线资源；只在大能之物上出现）
      if (eff.favor) {
        const f = Math.floor(eff.favor * scopeMul)
        set({ favor: get().favor + f })
        log(`仙缘 +${f}`, 'gold')
      }
      if (!eff.exp && eff.special === 'full_heal') {
        log(`服用 ${item.name}${markNote}，伤势尽复、灵力回满。`, 'gold')
      } else if (!eff.exp && eff.special === 'cleanse') {
        log(`服用 ${item.name}${markNote}，心魔杂念为之一清${scopeNote}。`, 'good')
      } else if (!eff.exp && (eff.hp || eff.energy)) {
        log(`服用 ${item.name}${markNote}，气血/灵力有所恢复${scopeNote}。`, 'good')
      } else if (!eff.exp) {
        log(`使用 ${item.name}${markNote}。`, 'good')
      }
      if (eff.stone) {
        const s = Math.floor(eff.stone * scopeMul)
        set({ stones: get().stones + s })
        log(`灵石 +${s}`, 'good')
      }
      if (item.pillGrade || item.herbTier) {
        log(`${itemTierText(item)}${itemScopeText(item) ? ` · ${itemScopeText(item)}` : ''}`, 'dim')
      }
      set({ player: p, inventory: inv })
      unlockCodex(get, set, 'item', id)
      afterProgressSnapshot(get, set)
    },

    comprehendGongfa: (scrollItemId) => {
      const { inventory, player, gongfa, treasures, legacy } = get()
      if (!player || !player.alive) return
      const g = gongfaByScrollId(scrollItemId)
      if (!g) return
      if ((inventory[scrollItemId] ?? 0) <= 0) {
        log('背包中没有这部秘籍。', 'bad')
        return
      }
      if (gongfa.learned[g.id]) {
        log('此功法已在修习之中。', 'dim')
        return
      }
      if (!canLearnGongfaFull(g, player.realm)) {
        log(
          `参悟《${g.name}》需达${gongfaRealmText(g)}且品阶相称（${g.grade} · ${gongfaScopeText(g)}）。`,
          'bad',
        )
        return
      }
      const inv = { ...inventory }
      removeItem(inv, scrollItemId)
      const learned = { ...gongfa.learned, [g.id]: { stage: 0 } }
      const p = recomputeVitals(get, { ...player }, treasures, learned, legacy.daoMarks, player.realm)
      log(`你翻开《${g.name}》，朝夕参诵，功法入门。`, 'gold')
      set({ inventory: inv, gongfa: { learned }, player: p })
      unlockCodex(get, set, 'gongfa', g.id)
      afterProgressSnapshot(get, set)
    },

    advanceGongfaStage: (id) => {
      const { player, gongfa, treasures, legacy } = get()
      if (!player || !player.alive) return
      const g = GONGFAS[id]
      if (!g) return
      const learnedState = gongfa.learned[id]
      if (!learnedState) {
        log('尚未参悟此功法。', 'bad')
        return
      }
      if (learnedState.stage >= GONGFA_STAGE_LABELS.length - 1) {
        log('此功法已臻圆满，进境无可复加。', 'dim')
        return
      }
      // 残卷功法进阶更省
      const fromSeal = (legacy.sealed ?? []).some((s) => s.kind === 'gongfa' && s.id === id)
      const cost = Math.floor(gongfaAdvanceCost(g, learnedState.stage) * (fromSeal ? 0.7 : 1))
      if (player.exp < cost) {
        log(`进阶「${GONGFA_STAGE_LABELS[learnedState.stage + 1]}」需消耗修为 ${cost}，当前修为不足。`, 'bad')
        return
      }
      const learned = { ...gongfa.learned, [id]: { stage: learnedState.stage + 1 } }
      const p = recomputeVitals(get, { ...player, exp: player.exp - cost }, treasures, learned, legacy.daoMarks, player.realm)
      log(
        `修为灌顶，《${g.name}》修至「${GONGFA_STAGE_LABELS[learnedState.stage + 1]}」！${fromSeal ? '（残卷余韵，消耗降低）' : ''}`,
        'gold',
      )
      set({ player: p, gongfa: { learned } })
    },

    sellItem: (id) => {
      const { inventory, stones, treasures, player, gongfa, legacy } = get()
      const count = inventory[id] ?? 0
      const item = ITEMS[id]
      if (count <= 0 || !item || !player) return
      // 唯一不可出售的：宗门秘法（非坊市流通的功法）
      const scrollG = gongfaByScrollId(id)
      if (scrollG && !isMarketGongfa(scrollG)) {
        log('宗门功法乃传承之物，不可转售。', 'bad')
        return
      }
      const inv = { ...inventory }
      removeItem(inv, id)
      const price = Math.floor(item.price * 0.55)
      // 出售认主法宝会失去加成：只扣一件，同类保留
      const isTreasure = itemCategory(id) === 'treasure'
      let newTreasures = treasures
      if (isTreasure) {
        const idx = treasures.indexOf(id)
        if (idx >= 0) {
          newTreasures = [...treasures.slice(0, idx), ...treasures.slice(idx + 1)]
        }
      }
      let p = player
      if (isTreasure && treasures.includes(id)) {
        p = recomputeVitals(get, { ...player }, newTreasures, gongfa.learned, legacy.daoMarks, player.realm)
      }
      log(`出售 ${item.name}，得灵石 +${price}`, 'dim')
      set({ inventory: inv, stones: stones + price, treasures: newTreasures, player: p })
    },

    buyItem: (id) => {
      const { inventory, stones, player, treasures } = get()
      const item = ITEMS[id]
      if (!item || !player) return
      // 境界只约束「使用」，不约束买卖：此处不再按境界拦购（买不买得起是灵石的事）
      // v1.4 成交价：通缉溢价（≥4）与正道名宿九折叠加
      const price = marketPriceOf(item.price, {
        wanted: get().wanted,
        repRight: player.repRight,
        repDemonic: player.repDemonic,
      })
      if (stones < price) return
      const inv = { ...inventory }
      addItem(inv, id)
      // 法宝购入即认主；同类多件全部计入列表，便于背包按 ×N 展示
      const isTreasure = itemCategory(id) === 'treasure'
      const newTreasures = isTreasure ? [...treasures, id] : treasures
      const bought = { ...get().player!, stones: stones - price }
      const p = isTreasure ? recomputeVitals(get, bought, newTreasures, get().gongfa.learned, get().legacy.daoMarks, bought.realm) : bought
      let nextArts = get().artifacts
      if (isTreasure) {
        // 坊市现货按凡品入库；无同类出战则认主
        const hasActive = treasures.includes(id)
        const inst = {
          ...createArtifactInstance({ itemId: id, quality: 'mortal' as ArtifactQuality, qualityCap: 'mortal' as ArtifactQuality }),
          equipped: !hasActive,
          affixes: [] as { id: string }[],
        }
        nextArts = [...get().artifacts, inst]
      }
      log(`购入 ${item.name}，花费灵石 ${price}`, 'dim')
      set({
        inventory: inv,
        stones: stones - price,
        treasures: newTreasures,
        artifacts: nextArts,
        player: p,
      })
      unlockCodex(get, set, 'item', id)
      afterProgressSnapshot(get, set)
    },
  }
}
