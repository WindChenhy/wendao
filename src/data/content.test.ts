import { describe, expect, it } from 'vitest'
import { BREAKTHROUGH_MATERIALS, ITEMS, MARKET_STOCK, TREASURE_BONUS, consumableExpGain, displayItemName } from './items'
import { HERB_ITEMS, RECIPE_LIST } from './abode'
import { ARTIFACT_RECIPES } from './artifacts'
import { ENEMY_TEMPLATES, hasEnemyTemplate, previewEnemy } from './enemies'
import { SECRET_REALMS } from './secretRealms'
import {
  GONGFA_LIST,
  GONGFAS,
  gongfaByScrollId,
  gongfaGradesAllowed,
  gongfaGradeOk,
  gongfaInScope,
  gongfaScrollId,
} from './gongfa'
import { ASCENSION_REALM, CULTIVATABLE_REALMS, REALMS, REALM_ORDER, expNeeded, nextRealm, realmIndex } from './realms'
import { WORLD_EVENTS } from './events'
import { codexEntries, FACTION_LABEL } from './codex'
import { APTITUDE_LIST } from './aptitudes'
import { ORIGIN_LIST } from './origins'
import { PATH_LIST, usedSecondarySlots } from './classes'
import { skillsForClass } from './skills'
import {
  ACHIEVEMENTS,
  ACHIEVEMENT_DAO_CAP,
  grantAchievementDaoMarks,
} from './achievements'
import { SECTS } from './sects'
import { SECT_RANKS } from './sects'
import { pathUnlockStatus, totalTowerFloors, type UnlockCtx } from '../game/paths'
import type { GongfaGrade } from './gongfa'
import type { Faction, MetaStats } from '../types'

/** 数据完备性：所有跨表引用必须落在已定义的 id 上 */

const FACTIONS: Faction[] = ['righteous', 'demonic', 'beast', 'abomination', 'rogue']
const ENEMY_TIERS = ['minion', 'normal', 'elite', 'boss'] as const
const GONGFA_KINDS = ['心法', '攻击法诀', '防御法', '身法', '锻体法', '功法'] as const
const GRADES: GongfaGrade[] = ['黄阶', '玄阶', '地阶', '天阶', '仙阶']

describe('灵根 · 出身 · 道途数据完备性', () => {
  it('灵根表：4 种资质，字段合法，恰有一种为中性（旧档默认）', () => {
    expect(APTITUDE_LIST.length).toBeGreaterThanOrEqual(4)
    const neutral = APTITUDE_LIST.filter(
      (a) =>
        a.cultivateRate === 1 &&
        a.breakthroughBonus === 0 &&
        a.atkMul === 1 &&
        a.defMul === 1 &&
        a.hpMul === 1,
    )
    expect(neutral.length, '恰应有一种完全中性的灵根（旧档迁移默认值）').toBe(1)
    for (const a of APTITUDE_LIST) {
      expect(a.name.length > 0 && a.desc.length > 0 && a.detail.length > 0).toBe(true)
      expect(a.cultivateRate > 0.8 && a.cultivateRate <= 1.25, `灵根 ${a.id} 修炼倍率越界`).toBe(true)
      expect(a.atkMul > 0 && a.defMul > 0 && a.hpMul > 0).toBe(true)
    }
  })

  it('出身表：起始灵石非负，起始行囊中的物品 id 可解析', () => {
    for (const o of ORIGIN_LIST) {
      expect(o.startStones >= 0, `出身 ${o.id} 起始灵石为负`).toBe(true)
      for (const id of Object.keys(o.startItems)) {
        expect(displayItemName(id), `出身 ${o.id} 的起始物品 ${id} 无法解析`).not.toBe(id)
      }
    }
  })

  it('道途表：12 条道途，含战道/艺道/禁道，数值与立道条件合法', () => {
    expect(PATH_LIST.length).toBe(12)
    expect(PATH_LIST.some((p) => p.kind === 'combat')).toBe(true)
    expect(PATH_LIST.some((p) => p.kind === 'craft')).toBe(true)
    expect(PATH_LIST.some((p) => p.kind === 'forbidden')).toBe(true)
    for (const p of PATH_LIST) {
      expect(p.name.length > 0 && p.title.length > 0 && p.lore.length > 0).toBe(true)
      expect(p.cultivateRate > 0.8 && p.cultivateRate <= 1.3, `道途 ${p.id} 修炼倍率越界`).toBe(true)
      expect(p.unlock, `道途 ${p.id} 缺少立道条件`).toBeDefined()
      expect(p.unlock?.note?.length ?? 0, `道途 ${p.id} 缺少条件说明`).toBeGreaterThan(0)
      if (p.unlock?.minRealm) {
        expect(REALM_ORDER.includes(p.unlock.minRealm), `道途 ${p.id} 的 minRealm 非法`).toBe(true)
      }
      if (p.unlock?.minLayer != null) {
        const maxLayers = REALMS[p.unlock.minRealm ?? 'qi'].layers
        expect(p.unlock.minLayer >= 1 && p.unlock.minLayer <= maxLayers).toBe(true)
      }
      for (const [key, need] of Object.entries(p.unlock?.stats ?? {})) {
        expect(
          [
            'combatsWon',
            'combatsLost',
            'pillsCrafted',
            'artifactsForged',
            'towerFloors',
            // R-27 质变型条件
            'bestDanMarks',
            'bestArtifactTier',
            'maxSwordIntent',
          ].includes(key),
          `道途 ${p.id} 的统计条件 ${key} 非法`,
        ).toBe(true)
        expect(need > 0).toBe(true)
      }
    }
  })

  it('新角色（未择道）即可通过全部道途的立道校验：首立之道不占兼修位', () => {
    const stats: MetaStats = {
      combatsWon: 999,
      combatsLost: 999,
      pillsCrafted: 999,
      artifactsForged: 999,
      stonesPeak: 0,
      offlineSettled: 0,
      bestDanMarks: 5,
      bestArtifactTier: 4,
      maxSwordIntent: 5,
    }
    const ctx: UnlockCtx = {
      realm: 'tribulation',
      layer: 3,
      stats,
      towerFloors: 999,
      repDemonic: 999,
      stones: 999999,
      lifespanLeft: 9999,
      ownedPaths: [],
    }
    for (const p of PATH_LIST) {
      expect(pathUnlockStatus(p, ctx).ok, `道途 ${p.id} 在满足全部条件时仍不可立`).toBe(true)
    }
    // 渡劫期兼修位恰为 5：取 5 门非禁忌道途占满兼修位后，禁忌道途（魂道/魔道）仍可立——
    // R-24 起禁忌道途以永久心魔为代价，不再占兼修位
    const nonForbidden = PATH_LIST.filter((p) => p.kind !== 'forbidden')
    expect(nonForbidden.length).toBeGreaterThan(5)
    const fill = nonForbidden.slice(0, 6) // 1 主修 + 5 兼修
    const full: UnlockCtx = { ...ctx, ownedPaths: fill.map((p) => p.id) }
    expect(usedSecondarySlots(fill.map((p) => p.id))).toBe(5)
    for (const forbidden of PATH_LIST.filter((p) => p.kind === 'forbidden')) {
      const st = pathUnlockStatus(forbidden, full)
      expect(st.ok, `禁忌道途 ${forbidden.id} 不应被兼修位拦截`).toBe(true)
      expect(st.missing.some((m) => m.includes('兼修位'))).toBe(false)
    }
    // 非禁忌兼修位满时，另一门非禁忌道途应被兼修位拦下
    const extra = nonForbidden[6]
    if (extra) {
      const st = pathUnlockStatus(extra, full)
      expect(st.ok).toBe(false)
      expect(st.missing.some((m) => m.includes('兼修位'))).toBe(true)
    }
    // 禁忌道途不计入占用位（主修为剑、兼修魂魔 → 占用 0）
    expect(usedSecondarySlots(['sword', 'soul', 'demon'])).toBe(0)
  })

  it('totalTowerFloors 累计各秘境层数', () => {
    expect(totalTowerFloors({ a: 3, b: 5 })).toBe(8)
    expect(totalTowerFloors({})).toBe(0)
  })

  it('R-29：12 条道途各含 1 被动 + 2 主动技能，且 id 唯一', () => {
    const ids = new Set<string>()
    for (const p of PATH_LIST) {
      const skills = skillsForClass(p.id)
      expect(skills.filter((s) => s.type === 'passive').length, `${p.id} 被动技数量不为 1`).toBe(1)
      expect(skills.filter((s) => s.type === 'active').length, `${p.id} 主动技数量不为 2`).toBe(2)
      for (const s of skills) {
        expect(ids.has(s.id), `技能 id 重复：${s.id}`).toBe(false)
        ids.add(s.id)
        expect(s.classId).toBe(p.id)
        expect(s.name.length > 0 && s.desc.length > 0, `技能 ${s.id} 缺名/描述`).toBe(true)
      }
    }
  })

  it('R-29：新增道途（御兽/傀儡/医/音、符阵拆分）齐备且立道条件合法', () => {
    for (const id of ['beast', 'puppet', 'medicine', 'music', 'formation']) {
      const def = PATH_LIST.find((p) => p.id === id)
      expect(def, `缺少新道途 ${id}`).toBeDefined()
      expect(def!.unlock, `${id} 缺立道条件`).toBeDefined()
      expect(def!.tags.length).toBeGreaterThan(0)
    }
    // 符阵拆分后，符道（talisman）与阵道（formation）并存且各司其职
    const talisman = PATH_LIST.find((p) => p.id === 'talisman')!
    const formation = PATH_LIST.find((p) => p.id === 'formation')!
    expect(talisman.name).toBe('符道')
    expect(formation.name).toBe('阵道')
    expect(talisman.unlock!.stats?.towerFloors).not.toBe(formation.unlock!.stats?.towerFloors)
  })
})

describe('SPRINT B 批次 A 回归守卫', () => {
  it('R-00：每个阵营都有中文标签（新增 Faction 必须同步 codex 标签表）', () => {
    for (const f of FACTIONS) {
      expect(FACTION_LABEL[f], `阵营 ${f} 缺少中文标签，图鉴会显示英文枚举名`).toBeDefined()
      expect(FACTION_LABEL[f].length).toBeGreaterThan(0)
    }
  })

  it('R-02：每个丹药品阶 1–9 都有可获得的三纹以上丹药（丹方或坊市）', () => {
    const recipeOutputs = new Set(RECIPE_LIST.map((r) => r.outputItemId))
    const market = new Set(MARKET_STOCK.pill)
    for (let grade = 1; grade <= 9; grade += 1) {
      const candidates = Object.values(ITEMS).filter(
        (i) => i.pillGrade === grade && (i.danMarks ?? 0) >= 3,
      )
      expect(candidates.length, `品阶 ${grade} 没有任何三纹以上丹药`).toBeGreaterThan(0)
      const reachable = candidates.filter((i) => recipeOutputs.has(i.id) || market.has(i.id))
      expect(reachable.length, `品阶 ${grade} 的三纹以上丹药既无丹方也不上架`).toBeGreaterThan(0)
      const craftable = candidates.filter((i) => recipeOutputs.has(i.id))
      expect(craftable.length, `品阶 ${grade} 缺少可炼制的丹纹丹方（炼丹玩家永远做不出）`).toBeGreaterThan(0)
    }
  })

  it('R-02：五纹丹"每点药效成本"不高于无纹丹的 3 倍（丹纹倍率 1.75）', () => {
    const DAN_MARK_MUL_5 = 1.75
    for (const item of Object.values(ITEMS)) {
      if (!/_w5$/.test(item.id)) continue
      const base = ITEMS[item.id.replace(/_w5$/, '')]
      if (!base || base.price <= 0) continue
      const ratio = item.price / DAN_MARK_MUL_5 / base.price
      expect(ratio, `五纹丹 ${item.id} 每点药效成本是无纹的 ${ratio.toFixed(2)} 倍`).toBeLessThanOrEqual(3)
    }
  })

  it('R-08：丹方主药阶不超过产物品阶 + 1', () => {
    for (const r of RECIPE_LIST) {
      const out = ITEMS[r.outputItemId]
      if (!out?.pillGrade) continue
      const maxTier = Math.max(
        0,
        ...r.inputs.map((i) => HERB_ITEMS[i.itemId]?.herbTier ?? ITEMS[i.itemId]?.herbTier ?? 0),
      )
      expect(
        maxTier,
        `丹方 ${r.id} 用 ${maxTier} 阶主药炼 ${out.pillGrade} 品丹`,
      ).toBeLessThanOrEqual(out.pillGrade + 1)
    }
  })

  it('R-04：境界表不再保留从未被消费的 expPerLayer', () => {
    for (const id of REALM_ORDER) {
      expect(
        Object.prototype.hasOwnProperty.call(REALMS[id], 'expPerLayer'),
        `${id} 仍带死字段 expPerLayer`,
      ).toBe(false)
    }
  })

  it('R-05：秘境层数随境界单调不减（大乘/渡劫不再回落）', () => {
    const maxFloorsByRealm = new Map<number, number>()
    for (const r of SECRET_REALMS) {
      const ri = realmIndex(r.minRealm)
      maxFloorsByRealm.set(ri, Math.max(maxFloorsByRealm.get(ri) ?? 0, r.floors))
    }
    const idx = [...maxFloorsByRealm.keys()].sort((a, b) => a - b)
    for (let i = 1; i < idx.length; i += 1) {
      const prev = maxFloorsByRealm.get(idx[i - 1])!
      const cur = maxFloorsByRealm.get(idx[i])!
      expect(
        cur,
        `境界序号 ${idx[i]} 的秘境层数 ${cur} 低于前一境的 ${prev}`,
      ).toBeGreaterThanOrEqual(prev)
    }
  })

  it('R-06：势力名统一为「血煞魔宫」（无万魔窟/血魔坛主/血煞坛主残留）', () => {
    const stale = ['万魔窟', '血魔坛主', '血煞坛主']
    const haystack = JSON.stringify(ENEMY_TEMPLATES) + JSON.stringify(WORLD_EVENTS)
    for (const name of stale) {
      expect(haystack.includes(name), `仍存在漂移势力名「${name}」`).toBe(false)
    }
  })

  it('R-07：品阶门槛只管"新参悟"，已参悟功法按 maxRealm 判生效（语义已固化）', () => {
    // 地阶《长春功》：大乘期不能再新参悟，但不设上限 → 已学者继续生效
    const changchun = GONGFAS['gf_changchun']
    expect(changchun.grade).toBe('地阶')
    expect(gongfaGradeOk(changchun, 'mahayana')).toBe(false)
    expect(gongfaInScope(changchun, 'mahayana')).toBe(true)
    // 通则：任何功法在其起步境界都必须可参悟，且必然生效
    for (const g of GONGFA_LIST) {
      expect(gongfaGradeOk(g, g.minRealm), `功法 ${g.id} 在起步境界反而不允许参悟`).toBe(true)
      expect(gongfaInScope(g, g.minRealm), `功法 ${g.id} 在起步境界反而不生效`).toBe(true)
    }
    // maxRealm 若存在，必须不早于起步境界
    for (const g of GONGFA_LIST) {
      if (!g.maxRealm) continue
      expect(
        realmIndex(g.maxRealm),
        `功法 ${g.id} 的 maxRealm 早于 minRealm`,
      ).toBeGreaterThanOrEqual(realmIndex(g.minRealm))
    }
  })

  it('R-02：每个品阶至少有一条「不至于荒谬」的丹方（坊市买料成本 ≤ 丹价 2 倍）', () => {
    // 说明：炼丹的经济来源是灵田自种（种子价 << 灵药价），按坊市买料算本就多为亏本，
    // 因此不要求"炼比买便宜"，只防止出现「材料成本远超丹价」这种无人会用的配方。
    const bestByGrade = new Map<number, number>()
    for (const r of RECIPE_LIST) {
      const out = ITEMS[r.outputItemId]
      if (!out?.pillGrade || !out.price) continue
      const cost = r.inputs.reduce(
        (n, i) => n + (ITEMS[i.itemId]?.price ?? HERB_ITEMS[i.itemId]?.price ?? 0) * i.count,
        0,
      )
      if (cost <= 0) continue
      const ratio = out.price / cost
      bestByGrade.set(out.pillGrade, Math.max(bestByGrade.get(out.pillGrade) ?? 0, ratio))
    }
    for (let grade = 1; grade <= 9; grade += 1) {
      const best = bestByGrade.get(grade)
      expect(best, `品阶 ${grade} 没有任何可核算的丹方`).toBeDefined()
      expect(
        best!,
        `品阶 ${grade} 最好的丹方性价比仅 ${best!.toFixed(2)}（材料成本超过丹价 2 倍）`,
      ).toBeGreaterThanOrEqual(0.5)
    }
  })

  it('R-03：修为丹收益只有一个口径（数据 exp × 丹纹 × 超范围衰减）', () => {
    const qiPill = ITEMS['pill_qi'] // 一品无纹，数据 exp 80，maxRealm=foundation
    expect(qiPill.effect?.exp).toBe(80)
    expect(consumableExpGain(qiPill, 'qi')).toBe(80)
    expect(consumableExpGain(qiPill, 'foundation')).toBe(80)
    // 超范围 → 25%
    expect(consumableExpGain(qiPill, 'golden_core')).toBe(20)
    // 三纹 = 1.45 倍
    const w3 = ITEMS['pill_qi_w3']
    expect(consumableExpGain(w3, 'qi')).toBe(Math.floor(80 * 1.45))
    // 非修为类物品不产生修为
    expect(consumableExpGain(ITEMS['pill_heal'], 'qi')).toBe(0)
  })
})

describe('丹方与炼器配方引用完整性', () => {
  it('所有丹方 inputs/outputItemId 存在于 ITEMS', () => {
    for (const r of RECIPE_LIST) {
      expect(
        ITEMS[r.outputItemId],
        `丹方 ${r.id} 的产物 ${r.outputItemId} 不在 ITEMS 中`,
      ).toBeDefined()
      expect(r.inputs.length >= 1 && r.inputs.length <= 3, `丹方 ${r.id} 的 inputs 数量异常`).toBe(true)
      for (const input of r.inputs) {
        expect(
          ITEMS[input.itemId],
          `丹方 ${r.id} 的原料 ${input.itemId} 不在 ITEMS 中`,
        ).toBeDefined()
        expect(
          input.count >= 1 && input.count <= 6,
          `丹方 ${r.id} 的原料 ${input.itemId} 数量 ${input.count} 超出 1-6`,
        ).toBe(true)
      }
      expect(r.craftDays >= 1, `丹方 ${r.id} 的 craftDays 异常`).toBe(true)
    }
  })

  it('所有炼器配方 itemId/inputs 存在于 ITEMS', () => {
    for (const r of ARTIFACT_RECIPES) {
      expect(
        ITEMS[r.itemId],
        `炼器方 ${r.id} 的产物 ${r.itemId} 不在 ITEMS 中`,
      ).toBeDefined()
      for (const input of r.inputs) {
        expect(
          ITEMS[input.itemId],
          `炼器方 ${r.id} 的原料 ${input.itemId} 不在 ITEMS 中`,
        ).toBeDefined()
        expect(input.count >= 1, `炼器方 ${r.id} 的原料 ${input.itemId} 数量异常`).toBe(true)
      }
      expect(
        r.baseRate > 0 && r.baseRate <= 98,
        `炼器方 ${r.id} 的 baseRate ${r.baseRate} 超出 1-98`,
      ).toBe(true)
      expect(r.minForgeLevel >= 1 && r.minForgeLevel <= 3, `炼器方 ${r.id} 的 minForgeLevel 异常`).toBe(true)
    }
  })
})

describe('敌人模板完备性', () => {
  it('模板 id 唯一且互不为前缀', () => {
    for (let i = 0; i < ENEMY_TEMPLATES.length; i++) {
      for (let j = i + 1; j < ENEMY_TEMPLATES.length; j++) {
        const a = ENEMY_TEMPLATES[i].id
        const b = ENEMY_TEMPLATES[j].id
        const clash =
          a === b || a.startsWith(`${b}_`) || b.startsWith(`${a}_`)
        expect(clash, `敌人模板 id 前缀冲突：${a} 与 ${b}`).toBe(false)
      }
    }
  })

  it('faction/tier/power/matOffset/dropRate 取值合法', () => {
    for (const t of ENEMY_TEMPLATES) {
      expect(
        FACTIONS.includes(t.faction),
        `敌人模板 ${t.id} 的 faction ${t.faction} 非法`,
      ).toBe(true)
      expect(
        (ENEMY_TIERS as readonly string[]).includes(t.tier),
        `敌人模板 ${t.id} 的 tier ${t.tier} 非法`,
      ).toBe(true)
      expect(
        t.power >= 0.5 && t.power <= 1.7,
        `敌人模板 ${t.id} 的 power ${t.power} 超出 0.5-1.7`,
      ).toBe(true)
      expect(
        t.matOffset === 0 || t.matOffset === 1,
        `敌人模板 ${t.id} 的 matOffset ${t.matOffset} 非法`,
      ).toBe(true)
      if (t.dropRate !== undefined) {
        expect(
          t.dropRate > 0 && t.dropRate <= 1,
          `敌人模板 ${t.id} 的 dropRate ${t.dropRate} 非法`,
        ).toBe(true)
      }
      expect(t.name.length > 0, `敌人模板 ${t.id} 缺少名称`).toBe(true)
      expect(t.flavor.length > 0, `敌人模板 ${t.id} 缺少风味文案`).toBe(true)
      if (t.minRealm !== undefined) {
        expect(
          REALM_ORDER.includes(t.minRealm),
          `敌人模板 ${t.id} 的 minRealm ${t.minRealm} 非法`,
        ).toBe(true)
      }
    }
  })

  it('每个大境界、每个强度档都至少有一个可遭遇模板（境界门槛不会抽空牌池）', () => {
    for (const realm of REALM_ORDER) {
      const ri = realmIndex(realm)
      for (const tier of ENEMY_TIERS) {
        const pool = ENEMY_TEMPLATES.filter(
          (t) => t.tier === tier && (!t.minRealm || ri >= realmIndex(t.minRealm)),
        )
        expect(pool.length, `${realm} 境界缺少 ${tier} 档可遭遇模板`).toBeGreaterThan(0)
      }
    }
  })

  it('五大阵营均有模板覆盖（righteous/abomination/rogue 为本批补齐）', () => {
    const seen = new Set(ENEMY_TEMPLATES.map((t) => t.faction))
    for (const f of FACTIONS) {
      expect(seen.has(f), `敌人表缺少阵营 ${f} 的模板`).toBe(true)
    }
  })

  it('历练掉落材料与突破链一致（防手工映射表复制粘贴断链）', () => {
    const matTemplate = ENEMY_TEMPLATES.find((t) => t.matOffset === 0)
    expect(matTemplate, '缺少 matOffset=0 的历练模板').toBeTruthy()
    // 材料表以「目标境界」为键：从 R 境出发所需材料 = BREAKTHROUGH_MATERIALS[nextRealm(R)]
    for (const realm of CULTIVATABLE_REALMS) {
      const target = nextRealm(realm)
      const expected = target ? BREAKTHROUGH_MATERIALS[target] : undefined
      if (!expected) continue // 渡劫 → 飞升无突破材料
      const drop = previewEnemy(matTemplate!, realmIndex(realm), 1).loot.itemId
      expect(drop, `${realm} 境历练掉落了错误的突破材料（应 ${expected}）`).toBe(expected)
    }
  })

  it('事件数据引用的 bossId 必须命中敌人模板（防事件战斗退回空壳）', () => {
    for (const e of WORLD_EVENTS) {
      const ids: string[] = []
      if (e.payload?.bossId) ids.push(e.payload.bossId)
      for (const a of e.actions ?? []) {
        if (a.outcome?.bossId) ids.push(a.outcome.bossId)
      }
      for (const id of ids) {
        expect(hasEnemyTemplate(id), `事件 ${e.id} 的 bossId「${id}」不在敌人模板表中`).toBe(true)
      }
    }
  })
})

describe('秘境完备性', () => {
  it('秘境 id 唯一且字段合法', () => {
    const ids = new Set<string>()
    for (const r of SECRET_REALMS) {
      expect(ids.has(r.id), `秘境 id 重复：${r.id}`).toBe(false)
      ids.add(r.id)
      expect(
        REALM_ORDER.includes(r.minRealm),
        `秘境 ${r.id} 的 minRealm ${r.minRealm} 非法`,
      ).toBe(true)
      expect(
        r.floors >= 1 && r.bossEvery >= 1 && r.bossEvery <= r.floors,
        `秘境 ${r.id} 的 floors/bossEvery 异常（${r.floors}/${r.bossEvery}）`,
      ).toBe(true)
      expect(r.env.rewardMul > 0, `秘境 ${r.id} 的 rewardMul 异常`).toBe(true)
      if (r.env.playerHpMul !== undefined) {
        expect(
          r.env.playerHpMul > 0 && r.env.playerHpMul <= 1,
          `秘境 ${r.id} 的 playerHpMul ${r.env.playerHpMul} 超出 (0,1]`,
        ).toBe(true)
      }
      expect(r.loot.stonePerFloor >= 0 && r.loot.expPerFloor >= 0, `秘境 ${r.id} 的每层奖励为负`).toBe(true)
      if (r.loot.bossItemId) {
        expect(
          ITEMS[r.loot.bossItemId],
          `秘境 ${r.id} 的镇守掉落 ${r.loot.bossItemId} 不在 ITEMS 中`,
        ).toBeDefined()
      }
    }
  })

  it('R-19：镇守节奏统一——每境 5~6 个镇守、顶层必为镇守层', () => {
    for (const r of SECRET_REALMS) {
      expect(
        Number.isInteger(r.floors / r.bossEvery),
        `秘境 ${r.id}：floors 必须被 bossEvery 整除，否则顶层无镇守（${r.floors}/${r.bossEvery}）`,
      ).toBe(true)
      const bossCount = r.floors / r.bossEvery
      expect(
        bossCount >= 5 && bossCount <= 6,
        `秘境 ${r.id}：镇守数 ${bossCount} 不在统一区间 [5,6]（比例 bossEvery/floors 应≈1/6）`,
      ).toBe(true)
      // bossEvery/floors 比例一致：1/6 ~ 1/5 之间
      const ratio = r.bossEvery / r.floors
      expect(
        ratio >= 1 / 6 - 1e-9 && ratio <= 1 / 5 + 1e-9,
        `秘境 ${r.id}：镇守间隔比例 ${ratio} 偏离统一节奏`,
      ).toBe(true)
    }
  })

  it('渡劫期与飞升后均有秘境（本批补齐）', () => {
    expect(
      SECRET_REALMS.some((r) => r.minRealm === 'tribulation'),
      '缺少渡劫期秘境',
    ).toBe(true)
    expect(
      SECRET_REALMS.some((r) => r.minRealm === 'ascended'),
      '缺少飞升后秘境',
    ).toBe(true)
  })
})

describe('功法品阶-起步境界规则', () => {
  it('全表满足品阶可见性规则（元婴以下天地玄黄/元婴以上天地玄/炼虚以上天地/大乘及以上仅天阶）', () => {
    for (const g of GONGFA_LIST) {
      expect(
        GRADES.includes(g.grade),
        `功法 ${g.id} 的品阶 ${g.grade} 非法`,
      ).toBe(true)
      expect(
        REALM_ORDER.includes(g.minRealm),
        `功法 ${g.id} 的 minRealm ${g.minRealm} 非法`,
      ).toBe(true)
      expect(
        (GONGFA_KINDS as readonly string[]).includes(g.kind),
        `功法 ${g.id} 的 kind ${g.kind} 非法`,
      ).toBe(true)
      if (g.grade === '仙阶') {
        // 仙阶传世特例：仅大乘及以上可参悟（gongfaGradeOk）
        expect(
          realmIndex(g.minRealm) >= realmIndex('mahayana'),
          `仙阶功法 ${g.id} 的起步境界 ${g.minRealm} 低于大乘`,
        ).toBe(true)
      } else {
        expect(
          gongfaGradesAllowed(g.minRealm).includes(g.grade),
          `功法 ${g.id}（${g.grade}）的起步境界 ${g.minRealm} 不允许该品阶`,
        ).toBe(true)
      }
      const e = g.effect
      const bounds: [string, number | undefined, number][] = [
        ['atk', e.atk, 0.6],
        ['def', e.def, 0.35],
        ['hp', e.hp, 0.45],
        ['cultivate', e.cultivate, 0.55],
        ['dodge', e.dodge, 0.18],
      ]
      for (const [key, val, cap] of bounds) {
        expect(
          val === undefined || (val > 0 && val <= cap),
          `功法 ${g.id} 的 effect.${key}=${val} 超出上限 ${cap}`,
        ).toBe(true)
      }
    }
  })
})

describe('坊市货架引用完整性', () => {
  it('pill/herb/material/treasure 货架条目均存在于 ITEMS', () => {
    for (const key of ['pill', 'herb', 'material', 'treasure'] as const) {
      for (const id of MARKET_STOCK[key]) {
        expect(ITEMS[id], `坊市 ${key} 货架的 ${id} 不在 ITEMS 中`).toBeDefined()
      }
    }
  })

  it('功法货架与 price>0 功法一一对应', () => {
    for (const id of MARKET_STOCK.gongfa) {
      expect(gongfaByScrollId(id), `坊市功法货架的 ${id} 无对应功法`).not.toBeNull()
    }
    for (const g of GONGFA_LIST) {
      if (g.price > 0) {
        expect(
          MARKET_STOCK.gongfa.includes(`scroll_${g.id}`),
          `坊市功法 ${g.id}（price=${g.price}）未上架`,
        ).toBe(true)
      }
    }
  })
})

describe('法宝与丹药字段完备性', () => {
  it('treasure_* 物品必有 treasureTier 且在 treasureBonus 有键', () => {
    for (const item of Object.values(ITEMS)) {
      if (!item.id.startsWith('treasure_')) continue
      expect(
        item.treasureTier !== undefined && item.treasureTier >= 1 && item.treasureTier <= 9,
        `法宝 ${item.id} 的 treasureTier 异常`,
      ).toBe(true)
      expect(TREASURE_BONUS[item.id], `法宝 ${item.id} 缺少 treasureBonus 条目`).toBeDefined()
    }
  })

  it('treasureBonus 键均指向法宝物品且数值合法', () => {
    for (const [id, bonus] of Object.entries(TREASURE_BONUS)) {
      expect(
        ITEMS[id]?.id.startsWith('treasure_'),
        `treasureBonus 键 ${id} 不是法宝物品`,
      ).toBe(true)
      const caps: [string, number | undefined, number][] = [
        ['atk', bonus.atk, 0.6],
        ['def', bonus.def, 0.45],
        ['hp', bonus.hp, 0.3],
        ['breakthrough', bonus.breakthrough, 12],
        ['cultivate', bonus.cultivate, 0.2],
        ['dodge', bonus.dodge, 0.05],
      ]
      for (const [key, val, cap] of caps) {
        expect(
          val === undefined || (val > 0 && val <= cap),
          `法宝 ${id} 的加成 ${key}=${val} 超出上限 ${cap}`,
        ).toBe(true)
      }
    }
  })

  it('丹药 pillGrade/danMarks、灵药 herbTier 取值合法', () => {
    for (const item of Object.values(ITEMS)) {
      if (item.pillGrade !== undefined) {
        expect(item.id.startsWith('pill_'), `带 pillGrade 的物品 ${item.id} 前缀异常`).toBe(true)
        expect(
          item.pillGrade >= 1 && item.pillGrade <= 9,
          `丹药 ${item.id} 的 pillGrade ${item.pillGrade} 超出 1-9`,
        ).toBe(true)
        expect(
          (item.danMarks ?? 0) >= 0 && (item.danMarks ?? 0) <= 5,
          `丹药 ${item.id} 的 danMarks ${item.danMarks} 超出 0-5`,
        ).toBe(true)
      }
      if (item.herbTier !== undefined) {
        expect(
          item.herbTier >= 1 && item.herbTier <= 9,
          `灵物 ${item.id} 的 herbTier ${item.herbTier} 超出 1-9`,
        ).toBe(true)
      }
    }
  })
})

describe('SPRINT B 批次 B 守卫', () => {
  it('R-12：成就道痕总和不超过单世软上限（道痕主要来源应为转生结算）', () => {
    const totalDao = ACHIEVEMENTS.reduce((n, a) => n + (a.reward.daoMarks ?? 0), 0)
    expect(totalDao, `成就道痕合计 ${totalDao}，超过单世上限 ${ACHIEVEMENT_DAO_CAP}`).toBeLessThanOrEqual(
      ACHIEVEMENT_DAO_CAP,
    )
  })

  it('R-12：仅渡劫/飞升叙事节点保留道痕奖励', () => {
    const daoIds = ACHIEVEMENTS.filter((a) => a.reward.daoMarks).map((a) => a.id)
    expect(daoIds.sort()).toEqual(['realm_ascend', 'realm_tribulation'])
  })

  it('R-12：每个成就至少有一个非空奖励字段', () => {
    for (const a of ACHIEVEMENTS) {
      const hasReward =
        (a.reward.stones ?? 0) > 0 || (a.reward.daoMarks ?? 0) > 0 || !!a.reward.title
      expect(hasReward, `成就 ${a.id} 没有任何奖励`).toBe(true)
    }
  })

  it('R-12：软上限把溢出道痕折算为灵石', () => {
    // 渡劫成就已领 10 点，再领飞升的 10 点：恰好到上限，无溢出
    expect(grantAchievementDaoMarks(['realm_tribulation'], 10)).toEqual({ daoMarks: 10, stones: 0 })
    // 已到上限，再发 5 点：全部折算灵石（每点 100）
    const capped = grantAchievementDaoMarks(['realm_tribulation', 'realm_ascend'], 5)
    expect(capped.daoMarks).toBe(0)
    expect(capped.stones).toBe(500)
    // 已用 10 点，再发 15 点：10 点入账、5 点折算灵石
    const partial = grantAchievementDaoMarks(['realm_tribulation'], 15)
    expect(partial).toEqual({ daoMarks: 10, stones: 500 })
  })

  it('R-16：仙阶为传世特例，price=0 不进坊市，且必有宗门藏经阁传承途径', () => {
    const xian = GONGFA_LIST.filter((g) => g.grade === '仙阶')
    expect(xian.length).toBeGreaterThan(0)
    for (const g of xian) {
      expect(g.price, `仙阶功法 ${g.id} 仍标价，会被坊市派生上架`).toBe(0)
      expect(
        MARKET_STOCK.gongfa.includes(gongfaScrollId(g.id)),
        `仙阶功法 ${g.id} 出现在坊市货架`,
      ).toBe(false)
      const inLibrary = SECTS.some((s) => s.library.some((l) => l.id === g.id))
      expect(inLibrary, `仙阶功法 ${g.id} 改离坊市后没有任何获取途径`).toBe(true)
    }
  })

  it('R-15：ascended 是终局哨兵而非可修境界（D-1 语义化）', () => {
    // 可修境界恰好九境，不含终局
    expect(CULTIVATABLE_REALMS).toHaveLength(9)
    expect(CULTIVATABLE_REALMS).not.toContain(ASCENSION_REALM)
    expect(REALM_ORDER[REALM_ORDER.length - 1]).toBe(ASCENSION_REALM)
    // 九境字段都是真实修行数据
    for (const r of CULTIVATABLE_REALMS) {
      const def = REALMS[r]
      expect(def.layers, `${r} 层数应大于 1`).toBeGreaterThan(1)
      expect(def.breakthroughBaseRate, `${r} 应有突破率`).toBeGreaterThan(0)
      expect(def.lifespan, `${r} 寿元应为有限值`).toBeLessThan(999999)
    }
    // 终局哨兵：无层可修、无关可破、仙寿哨兵值
    const asc = REALMS[ASCENSION_REALM]
    expect(asc.layers).toBe(1)
    expect(asc.breakthroughBaseRate).toBe(0)
    expect(asc.lifespan).toBe(999999)
    // 终局语义在规则函数中一致
    expect(expNeeded(ASCENSION_REALM, 1)).toBe(0)
    expect(nextRealm(ASCENSION_REALM)).toBeNull()
    expect(realmIndex(ASCENSION_REALM)).toBe(9)
    // 图鉴不得把 999999 当真实寿元展示
    const ascEntry = codexEntries('realm').find((e) => e.id === ASCENSION_REALM)
    expect(ascEntry?.desc).not.toContain('999999')
  })

  it('R-21：藏经阁道途传承条目结构合法（pathId/职位/境界/贡献齐备）', () => {
    const pathEntries = SECTS.flatMap((s) => s.library.map((l) => ({ s, l })).filter((x) => x.l.kind === 'path'))
    expect(pathEntries.length).toBeGreaterThanOrEqual(5)
    for (const { s, l } of pathEntries) {
      expect(l.pathId, `${s.id} 的传承 ${l.id} 缺 pathId`).toBeTruthy()
      expect(
        PATH_LIST.some((p) => p.id === l.pathId),
        `${s.id} 的传承 ${l.id} 指向不存在的道途 ${l.pathId}`,
      ).toBe(true)
      expect(l.cost, `${s.id} 的传承 ${l.id} 贡献须为正`).toBeGreaterThan(0)
      if (l.minRank) expect(SECT_RANKS[l.minRank], `${s.id} 传承职位非法`).toBeTruthy()
      if (l.minRealm) expect(REALMS[l.minRealm], `${s.id} 传承境界非法`).toBeTruthy()
      // 宗门立场与道途阵营不应自相矛盾（正道宗门不传魔道路途）
      const def = PATH_LIST.find((p) => p.id === l.pathId)
      if (s.alignment === 'righteous') {
        expect(['righteous', 'neutral']).toContain(def?.faction as string)
      }
    }
    // 五宗各有所传
    const sectsWithPath = new Set(pathEntries.map((x) => x.s.id))
    for (const id of ['qingyun', 'taiyi', 'haoti', 'xuesha', 'youming']) {
      expect(sectsWithPath.has(id), `宗门 ${id} 缺少道途传承`).toBe(true)
    }
  })
})
