import {
  PET_BREAK_LEVEL,
  PET_FEED_EXP,
  PET_FOOD_IDS,
  PET_MAP,
  PET_MAX_LEVEL,
  petExpNeed,
  type PetJob,
  type PetState,
} from '../../data/pets'
import { ITEMS } from '../../data/items'
import { removeItem } from '../../game/inventory'
import { bumpDaily, currentRules, log, runPetFarmAssist } from '../helpers'
import type { GameState, MetaGet, MetaSet } from '../gameState'
import { uniqIds } from '../saveMigrate'

/** pet 域：灵兽认主/改名/出战/喂食/突破/岗位/放生/灵田协助 */
export function createPetSlice(
  set: MetaSet,
  get: MetaGet,
): Pick<
  GameState,
  | 'obtainPet'
  | 'renamePet'
  | 'togglePetFight'
  | 'feedPet'
  | 'breakthroughPet'
  | 'setPetJob'
  | 'releasePet'
  | 'petFarmAssist'
> {
  return {
    obtainPet: (petId, name) => {
      const def = PET_MAP[petId]
      if (!def) return
      const next: PetState = {
        petId,
        name: (name || def.name).slice(0, 8),
        level: 1,
        exp: 0,
        bond: 10,
        job: 'none',
        jobOn: '',
        restUntilDay: 0,
        captureFails: 0,
        broken: false,
        fight: true,
      }
      const flags = [...get().companion.flags]
      if (!flags.includes('has_pet')) flags.push('has_pet')
      log('灵兽认主：' + next.name + '。', 'gold')
      set({ pet: next, petCaptureFails: 0, companion: { ...get().companion, flags: uniqIds(flags) } })
    },
    renamePet: (name) => {
      const { pet } = get()
      if (!pet) return
      set({ pet: { ...pet, name: name.trim().slice(0, 8) || pet.name } })
    },
    togglePetFight: () => {
      const { pet } = get()
      if (!pet) return
      set({ pet: { ...pet, fight: !pet.fight } })
    },
    feedPet: (foodId, count) => {
      const { pet, inventory } = get()
      if (!pet) return
      if (!PET_FOOD_IDS.includes(foodId)) {
        log('灵兽不吃这种灵药。', 'bad')
        return
      }
      const owned = inventory[foodId] ?? 0
      const n = Number.isFinite(count) ? Math.max(0, Math.min(Math.floor(count), owned)) : 0
      if (n <= 0) {
        log('没有合适的灵食。', 'bad')
        return
      }
      const inv = { ...inventory }
      removeItem(inv, foodId, n)
      // v1.4 御兽之道 DLC：喂养经验倍率（逐份结算，与单次喂食口径一致）
      const gain = Math.floor(PET_FEED_EXP * currentRules().petExpMul) * n
      let exp = pet.exp + gain
      let level = pet.level
      while (level < PET_MAX_LEVEL && exp >= petExpNeed(level)) {
        exp -= petExpNeed(level)
        level += 1
      }
      const bond = Math.min(100, pet.bond + 2 * n)
      const parts = [`经验 +${gain}`]
      if (level > pet.level) parts.push(`升至 Lv.${level}`)
      if (bond > pet.bond) parts.push(`亲密 +${bond - pet.bond}`)
      log(`喂食「${ITEMS[foodId]?.name ?? foodId}」×${n}，${parts.join('，')}。`, 'good')
      set({ inventory: inv, pet: { ...pet, exp, level, bond } })
      bumpDaily(get, set, 'feed')
    },
    breakthroughPet: () => {
      const { pet } = get()
      if (!pet || pet.level < PET_BREAK_LEVEL) {
        log(`灵兽需 Lv.${PET_BREAK_LEVEL} 方可突破。`, 'bad')
        return
      }
      if (pet.broken) {
        log(pet.name + ' 已完成突破。', 'dim')
        return
      }
      const def = PET_MAP[pet.petId]
      log(pet.name + ' 突破成功！属性系数 ×1.15。', 'gold')
      log(`「${def?.skillName ?? '辅助技'}」威力提升，文案焕然一新。`, 'good')
      set({ pet: { ...pet, broken: true, bond: Math.min(100, pet.bond + 10) } })
    },
    setPetJob: (job: PetJob) => {
      const { pet } = get()
      if (!pet) return
      set({ pet: { ...pet, job } })
    },
    releasePet: () => {
      const { pet } = get()
      if (!pet) return
      log('放生 ' + pet.name + '。', 'dim')
      const flags = get().companion.flags.filter((f) => f !== 'has_pet')
      set({ pet: null, petCaptureFails: 0, companion: { ...get().companion, flags } })
    },
    petFarmAssist: () => {
      runPetFarmAssist(get, set, { auto: false })
    },
  }
}
