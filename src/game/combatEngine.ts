import { CLASSES } from '../data/classes'
import { ITEMS } from '../data/items'
import {
  ATTACK_TREASURES,
  COMBAT_CONFIG,
  DEF_TREASURES,
  SKILLS,
  isSkillUnlocked,
  passiveForClass,
  unlockedActiveSkills,
  type SkillDef,
} from '../data/skills'
import type { ClassId, EnemyDef, RealmId } from '../types'

export type LogKind = 'sys' | 'player' | 'enemy' | 'status' | 'loot' | 'crit' | 'heal'

export interface CombatLogLine {
  text: string
  kind: LogKind
}

export type CombatStatusId =
  | 'sword_intent'
  | 'counter'
  | 'counter_buff'
  | 'shield'
  | 'stun'
  | 'sha_qi'
  | 'enrage'
  | 'weaken'
  | 'atk_up'
  | 'regen'
  | 'talisman_charge'

export interface CombatStatus {
  id: CombatStatusId | string
  stacks?: number
  turns?: number
  value?: number
}

export interface CombatActor {
  name: string
  classId?: ClassId
  atk: number
  def: number
  hp: number
  maxHp: number
  energy: number
  maxEnergy: number
  isDemon: boolean
  dmgReduce: number
  statuses: CombatStatus[]
  skillCd: Record<string, number>
  potionsUsed: number
  isBoss: boolean
  tier: 'minion' | 'normal' | 'elite' | 'boss'
  enemySkills: SkillDef[]
  /** 器修共鸣等战斗内加成缓存 */
  artifactAtkMul: number
  artifactDefMul: number
  treasures: string[]
}

export type PlayerAction =
  | { type: 'attack' }
  | { type: 'defend' }
  | { type: 'skill'; skillId: string }
  | { type: 'potion'; itemId: string }

export interface CombatEngineResult {
  win: boolean
  log: CombatLogLine[]
  playerHpLeft: number
  playerEnergyLeft: number
  lifespanCost: number
  potionsUsed: string[]
  blastPillsUsed: string[]
  expGain: number
  stoneGain: number
  itemId?: string
  message: string
  rounds: number
}

export interface CombatEngineState {
  player: CombatActor
  enemy: CombatActor
  log: CombatLogLine[]
  round: number
  finished: boolean
  win: boolean
  lifespanCost: number
  potionsUsed: string[]
  blastPillsUsed: string[]
  potionLimit: number
  context: CombatContext
}

export type CombatContextKind = 'explore' | 'tower' | 'sect_exam' | 'event'

export interface CombatContext {
  kind: CombatContextKind
  title: string
  enemy: EnemyDef
  /** 秘境环境压气血后的战斗内气血（写回时另行换算） */
  hpScale: number
  exploreDay?: boolean
}

function getStatus(actor: CombatActor, id: string): CombatStatus | undefined {
  return actor.statuses.find((s) => s.id === id)
}

function statusStacks(actor: CombatActor, id: string): number {
  return getStatus(actor, id)?.stacks ?? 0
}

function addStatus(actor: CombatActor, id: string, stacks = 0, turns?: number, value?: number) {
  const cur = getStatus(actor, id)
  if (cur) {
    if (stacks) cur.stacks = (cur.stacks ?? 0) + stacks
    if (turns !== undefined) cur.turns = (cur.turns ?? 0) + turns
    if (value !== undefined) cur.value = value
    return
  }
  actor.statuses.push({
    id,
    stacks: stacks || undefined,
    turns,
    value,
  })
}

function removeStatus(actor: CombatActor, id: string) {
  actor.statuses = actor.statuses.filter((s) => s.id !== id)
}

function tickStatuses(actor: CombatActor, log: CombatLogLine[], side: 'player' | 'enemy') {
  const kind: LogKind = side === 'player' ? 'status' : 'status'
  const next: CombatStatus[] = []
  for (const s of actor.statuses) {
    if (s.id === 'regen' && s.turns && s.turns > 0) {
      const heal = Math.max(1, Math.floor(actor.maxHp * (s.value ?? 0.04)))
      actor.hp = Math.min(actor.maxHp, actor.hp + heal)
      log.push({ text: `${actor.name}药力流转，回复 ${heal} 气血。`, kind: 'heal' })
    }
    if (s.id === 'shield' && s.turns !== undefined) {
      s.turns -= 1
      if (s.turns <= 0) {
        log.push({ text: `${actor.name}的护盾消散。`, kind })
        continue
      }
    } else if (s.turns !== undefined && s.id !== 'sword_intent' && s.id !== 'sha_qi' && s.id !== 'talisman_charge') {
      s.turns -= 1
      if (s.turns <= 0) {
        log.push({ text: `${actor.name}的「${statusLabel(s.id)}」状态结束。`, kind })
        continue
      }
    }
    next.push(s)
  }
  actor.statuses = next
}

function statusLabel(id: string): string {
  const map: Record<string, string> = {
    sword_intent: '剑意',
    counter: '反伤',
    counter_buff: '反伤强化',
    shield: '护盾',
    stun: '眩晕',
    sha_qi: '煞气',
    enrage: '狂暴',
    weaken: '虚弱',
    atk_up: '攻击提升',
    regen: '药力',
    talisman_charge: '符能',
  }
  return map[id] ?? id
}

export function formatStatuses(actor: CombatActor): string {
  const parts = actor.statuses
    .map((s) => {
      if (s.id === 'sword_intent' || s.id === 'sha_qi' || s.id === 'talisman_charge') {
        return `${statusLabel(s.id)}×${s.stacks ?? 0}`
      }
      if (s.id === 'shield') return `护盾(${s.value ?? 0})`
      return statusLabel(s.id)
    })
    .filter(Boolean)
  return parts.length ? parts.join(' ') : '—'
}

function effAtk(actor: CombatActor, cfg = COMBAT_CONFIG): number {
  let atk = actor.atk * actor.artifactAtkMul
  const intent = statusStacks(actor, 'sword_intent')
  if (intent > 0) atk *= 1 + intent * cfg.swordIntentPerStack
  const sha = statusStacks(actor, 'sha_qi')
  if (sha > 0) atk *= 1 + sha * cfg.shaQiPerStack
  const up = getStatus(actor, 'atk_up')
  if (up?.turns && up.turns > 0) atk *= 1 + (up.value ?? 0)
  if (getStatus(actor, 'enrage')) atk *= 1.25
  const weak = getStatus(actor, 'weaken')
  if (weak?.turns && weak.turns > 0) atk *= 1 - (weak.value ?? 0.2)
  return Math.floor(atk)
}

function counterRatio(actor: CombatActor): number {
  let ratio = 0
  if (actor.classId === 'body' || getStatus(actor, 'counter')) ratio += 0.12
  const buff = getStatus(actor, 'counter_buff')
  if (buff?.turns && buff.turns > 0) ratio = Math.max(ratio, buff.value ?? 0.2)
  return ratio
}

function rollDamage(
  atk: number,
  def: number,
  multiplier: number,
  defPierce: number,
  dmgReduce: number,
  defending: boolean,
  critChance: number,
): { dmg: number; crit: boolean } {
  const cfg = COMBAT_CONFIG
  const pierceDef = def * 0.55 * (defPierce || 1)
  let raw = atk * multiplier - pierceDef + (Math.random() * 8 - 3)
  if (multiplier === 0) raw = 0
  let dmg = Math.max(0, Math.floor(raw))
  dmg = Math.floor(dmg * (1 - dmgReduce))
  if (defending) dmg = Math.floor(dmg * cfg.defendDmgReduce)
  const crit = dmg > 0 && Math.random() < critChance
  if (crit) dmg = Math.floor(dmg * cfg.critMultiplier)
  return { dmg, crit }
}

function pushLog(log: CombatLogLine[], text: string, kind: LogKind) {
  log.push({ text, kind })
}

export function buildPlayerCombatActor(opts: {
  name: string
  classId: ClassId
  realm: RealmId
  layer: number
  hp: number
  maxHp: number
  energy: number
  maxEnergy: number
  atk: number
  def: number
  dmgReduce: number
  treasures: string[]
  hpScale?: number
}): CombatActor {
  const treasures = opts.treasures
  let artifactAtkMul = 1
  let artifactDefMul = 1
  if (opts.classId === 'artifact') {
    // 器修被动：认主法宝加成战斗内再放大
    artifactAtkMul = 1 + (treasures.some((t) => ATTACK_TREASURES.has(t)) ? 0.08 : 0)
    artifactDefMul = 1 + (treasures.some((t) => DEF_TREASURES.has(t)) ? 0.08 : 0)
    // 通用共鸣：有任一法宝时轻微提升
    if (treasures.some((t) => t.startsWith('treasure_'))) {
      artifactAtkMul *= 1.07
      artifactDefMul *= 1.07
    }
  }
  let maxEnergy = opts.maxEnergy
  if (opts.classId === 'artifact') {
    maxEnergy += treasures.filter((t) => t.startsWith('treasure_')).length * 5
  }
  const statuses: CombatStatus[] = []
  if (opts.classId === 'talisman') {
    statuses.push({ id: 'talisman_charge', stacks: 2 })
  }
  return {
    name: opts.name,
    classId: opts.classId,
    atk: opts.atk,
    def: Math.floor(opts.def * artifactDefMul),
    hp: Math.floor(opts.hp * (opts.hpScale ?? 1)),
    maxHp: Math.floor(opts.maxHp * (opts.hpScale ?? 1)),
    energy: opts.energy,
    maxEnergy,
    isDemon: opts.classId === 'demon',
    dmgReduce: opts.dmgReduce,
    statuses,
    skillCd: {},
    potionsUsed: 0,
    isBoss: false,
    tier: 'normal',
    enemySkills: [],
    artifactAtkMul,
    artifactDefMul,
    treasures,
  }
}

export function buildEnemyCombatActor(enemy: EnemyDef): CombatActor {
  const boss = enemy.id.includes('boss') || enemy.name.includes('镇守') || enemy.name.includes('坛主') || enemy.name.includes('王')
  const tier: CombatActor['tier'] = boss ? 'boss' : 'normal'
  const enemySkills: SkillDef[] = []
  if (boss) {
    enemySkills.push({
      id: `es_${enemy.id}_heavy`,
      classId: 'sword',
      name: '蓄力重击',
      type: 'active',
      cd: 4,
      hits: 1,
      multiplier: 1.7,
      defPierce: 1.1,
      desc: '',
      effects: [],
    })
  } else {
    enemySkills.push({
      id: `es_${enemy.id}_heavy`,
      classId: 'sword',
      name: '重击',
      type: 'active',
      cd: 3,
      hits: 1,
      multiplier: 1.35,
      defPierce: 1,
      desc: '',
      effects: [],
    })
  }
  return {
    name: enemy.name,
    atk: enemy.atk,
    def: enemy.def,
    hp: enemy.hp,
    maxHp: enemy.hp,
    energy: 999,
    maxEnergy: 999,
    isDemon: enemy.faction === 'demonic',
    dmgReduce: 0,
    statuses: [],
    skillCd: {},
    potionsUsed: 0,
    isBoss: boss,
    tier,
    enemySkills,
    artifactAtkMul: 1,
    artifactDefMul: 1,
    treasures: [],
  }
}

export function createCombatState(
  player: CombatActor,
  enemy: EnemyDef,
  context: CombatContext,
): CombatEngineState {
  const e = buildEnemyCombatActor(enemy)
  const log: CombatLogLine[] = [
    { text: `【${context.title}】${enemy.name}`, kind: 'sys' },
    {
      text: `你（${player.classId ? CLASSES[player.classId].name : '修士'}） VS ${enemy.name}`,
      kind: 'sys',
    },
    {
      text: `气血 ${player.hp}/${player.maxHp} · ${player.isDemon ? '魔元' : '灵力'} ${player.energy}/${player.maxEnergy} · 状态：${formatStatuses(player)}`,
      kind: 'sys',
    },
  ]
  if (player.classId === 'artifact') {
    pushLog(log, '法宝共鸣已生效。', 'status')
  }
  return {
    player,
    enemy: e,
    log,
    round: 0,
    finished: false,
    win: false,
    lifespanCost: 0,
    potionsUsed: [],
    blastPillsUsed: [],
    potionLimit:
      COMBAT_CONFIG.combatPotionLimit +
      (player.classId === 'alchemy' ? 1 : 0),
    context,
  }
}

export function playerSkillsAvailable(state: CombatEngineState): SkillDef[] {
  const p = state.player
  if (!p.classId) return []
  return unlockedActiveSkills(p.classId, state.context.enemy.realm, 1).map((s) => {
    // unlock uses player realm stored on context via enemy realm is wrong — use skill unlock check outside
    return s
  })
}

export function getUnlockedPlayerSkills(
  classId: ClassId,
  realm: RealmId,
  layer: number,
): SkillDef[] {
  return unlockedActiveSkills(classId, realm, layer)
}

export function canPaySkill(state: CombatEngineState, skill: SkillDef): boolean {
  const p = state.player
  const cost = skill.cost?.energy ?? 0
  const alt = skill.cost?.talismanChargeAlt
  if (p.energy >= cost) return true
  if (alt && statusStacks(p, 'talisman_charge') >= alt.charge && p.energy >= alt.energy) return true
  return false
}

function paySkill(state: CombatEngineState, skill: SkillDef) {
  const p = state.player
  const cost = skill.cost?.energy ?? 0
  const alt = skill.cost?.talismanChargeAlt
  if (p.energy >= cost) {
    p.energy -= cost
    return
  }
  if (alt && statusStacks(p, 'talisman_charge') >= alt.charge && p.energy >= alt.energy) {
    const st = getStatus(p, 'talisman_charge')
    if (st) st.stacks = (st.stacks ?? 0) - alt.charge
    p.energy -= alt.energy
    pushLog(state.log, `消耗符能×${alt.charge}，灵力 -${alt.energy}。`, 'status')
  }
}

function lifestealRatio(state: CombatEngineState, override?: number): number {
  if (override !== undefined) return override
  const p = state.player
  if (!p.isDemon && p.classId !== 'demon') return 0
  return COMBAT_CONFIG.demonLifesteal
}

function applyOnHitPassives(
  state: CombatEngineState,
  attacker: CombatActor,
  dmg: number,
  lifestealOverride?: number,
) {
  if (dmg <= 0) return
  const log = state.log
  const cfg = COMBAT_CONFIG
  if (attacker.classId === 'sword') {
    addStatus(attacker, 'sword_intent', 1)
    if (statusStacks(attacker, 'sword_intent') > cfg.swordIntentMax) {
      const st = getStatus(attacker, 'sword_intent')
      if (st) st.stacks = cfg.swordIntentMax
    }
  }
  if (attacker.classId === 'demon' || attacker.isDemon) {
    addStatus(attacker, 'sha_qi', 1)
    const st = getStatus(attacker, 'sha_qi')
    if (st && (st.stacks ?? 0) > cfg.shaQiMax) st.stacks = cfg.shaQiMax
  }
  const ls = lifestealRatio(state, lifestealOverride)
  const demonActive = attacker.classId === 'demon' || attacker.isDemon
  if (demonActive && ls > 0) {
    const heal = Math.floor(dmg * ls)
    if (heal > 0) {
      attacker.hp = Math.min(attacker.maxHp, attacker.hp + heal)
      pushLog(log, `煞气反哺，回复 ${heal} 气血。（煞气×${statusStacks(attacker, 'sha_qi')}）`, 'heal')
    }
  }
  if (attacker.classId === 'soul') {
    const passive = passiveForClass('soul')
    const per = passive?.effects?.find((e) => e.type === 'energy_on_damage')
    if (per) {
      // simplified: +2 energy per hit over 100 dmg threshold scaled
      const ticks = Math.floor(dmg / (per.per ?? 100))
      if (ticks > 0) {
        attacker.energy = Math.min(attacker.maxEnergy, attacker.energy + ticks * (per.gain ?? 2))
      }
    }
  }
}

function dealDamage(
  state: CombatEngineState,
  attacker: CombatActor,
  defender: CombatActor,
  opts: {
    multiplier: number
    defPierce?: number
    label: string
    kind: LogKind
    defending?: boolean
    lifestealOverride?: number
    extraMul?: number
  },
): number {
  const cfg = COMBAT_CONFIG
  const critChance = cfg.critBaseChance + (attacker.classId === 'sword' ? 0.05 : 0)
  const atk = effAtk(attacker) * (opts.extraMul ?? 1)
  const { dmg, crit } = rollDamage(
    atk,
    defender.def * defender.artifactDefMul,
    opts.multiplier,
    opts.defPierce ?? 1,
    defender.dmgReduce,
    opts.defending ?? false,
    critChance,
  )

  // shield absorb
  let remain = dmg
  const shield = getStatus(defender, 'shield')
  if (shield && (shield.value ?? 0) > 0 && remain > 0) {
    const absorb = Math.min(shield.value ?? 0, remain)
    shield.value = (shield.value ?? 0) - absorb
    remain -= absorb
    if ((shield.value ?? 0) <= 0) removeStatus(defender, 'shield')
    pushLog(state.log, `${opts.label}被护盾抵消 ${absorb} 点${remain > 0 ? `，实际受到 ${remain}` : '。'}`, opts.kind)
  }

  if (dmg <= 0 && opts.multiplier > 0) {
    pushLog(state.log, `${opts.label}被${defender.name}挡下，未伤分毫。`, opts.kind)
    return 0
  }

  defender.hp = Math.max(0, defender.hp - remain)
  if (opts.multiplier > 0) {
    const critTag = crit ? '暴击！' : ''
    pushLog(state.log, `${critTag}${opts.label}造成 ${dmg} 点伤害。`, crit ? 'crit' : opts.kind)
  }

  applyOnHitPassives(state, attacker, dmg, opts.lifestealOverride)

  // counter
  const cr = counterRatio(defender)
  if (cr > 0 && dmg > 0 && defender.hp > 0) {
    const back = Math.max(1, Math.floor(dmg * cr))
    attacker.hp = Math.max(0, attacker.hp - back)
    pushLog(state.log, `${defender.name}反震 ${back} 点。`, 'status')
  }

  return dmg
}

function tryPotion(state: CombatEngineState, itemId: string): boolean {
  const p = state.player
  // inventory is external — store handles stock; engine only validates limit & effect type
  const item = ITEMS[itemId]
  if (!item?.effect) return false
  if (item.effect.breakthroughRate && !item.effect.hp && !item.effect.energy) return false
  if (p.potionsUsed >= state.potionLimit) return false
  p.potionsUsed += 1
  state.potionsUsed.push(itemId)
  let mul = 1
  if (p.classId === 'alchemy') mul = 1.35
  if (item.effect.hp) {
    const heal = Math.floor(item.effect.hp * mul)
    p.hp = Math.min(p.maxHp, p.hp + heal)
    pushLog(state.log, `你服下${item.name}，气血 +${heal}。${p.classId === 'alchemy' ? '（丹道入微）' : ''}`, 'heal')
  }
  if (item.effect.energy) {
    const en = Math.floor((item.effect.energy as number) * mul)
    p.energy = Math.min(p.maxEnergy, p.energy + en)
    pushLog(state.log, `你服下${item.name}，灵力 +${en}。`, 'heal')
  }
  return true
}

function pickBlastPillId(inventory: Record<string, number>): string | null {
  const pills = Object.keys(inventory).filter(
    (id) => id.startsWith('pill_') && (inventory[id] ?? 0) > 0 && ITEMS[id]?.effect,
  )
  if (!pills.length) return null
  // prefer non-breakthrough combat-usable first, then any
  const usable = pills.filter((id) => ITEMS[id]?.effect?.exp || ITEMS[id]?.effect?.hp)
  const list = usable.length ? usable : pills
  list.sort((a, b) => (ITEMS[b]?.price ?? 0) - (ITEMS[a]?.price ?? 0))
  return list[0]
}

function blastMultiplier(itemId: string): number {
  const price = ITEMS[itemId]?.price ?? 0
  if (price >= 1000) return 2.3
  if (price >= 100) return 1.7
  return 1.2
}

function enemyAct(state: CombatEngineState) {
  const e = state.enemy
  const p = state.player
  const cfg = COMBAT_CONFIG
  if (e.hp <= 0 || state.finished) return

  const stun = getStatus(e, 'stun')
  if (stun?.turns && stun.turns > 0) {
    stun.turns = 0
    removeStatus(e, 'stun')
    pushLog(state.log, `${e.name}陷入眩晕，无法行动。`, 'status')
    return
  }

  if (e.hp <= e.maxHp * 0.3 && !getStatus(e, 'enrage')) {
    addStatus(e, 'enrage')
    pushLog(state.log, `${e.name}双目赤红，陷入狂暴！`, 'enemy')
  }

  const skill = e.enemySkills[0]
  const chance = cfg.enemySkillChance[e.tier] ?? 0.25
  const cdLeft = skill ? e.skillCd[skill.id] ?? 0 : 99
  if (skill && cdLeft <= 0 && Math.random() < chance) {
    e.skillCd[skill.id] = skill.cd ?? 3
    pushLog(state.log, `【${skill.name}】${e.name}悍然出手！`, 'enemy')
    dealDamage(state, e, p, {
      multiplier: skill.multiplier ?? 1,
      defPierce: skill.defPierce ?? 1,
      label: `${e.name}的${skill.name}`,
      kind: 'enemy',
    })
  } else {
    dealDamage(state, e, p, {
      multiplier: 1,
      defPierce: 1,
      label: `${e.name}对你`,
      kind: 'enemy',
    })
  }

  // boss heal once at 50%
  if (e.isBoss && e.hp > 0 && e.hp <= e.maxHp * 0.5 && !e.skillCd['boss_heal']) {
    e.skillCd['boss_heal'] = 99
    const heal = Math.floor(e.maxHp * 0.1)
    e.hp = Math.min(e.maxHp, e.hp + heal)
    pushLog(state.log, `${e.name}血气翻涌，回复 ${heal} 气血。`, 'enemy')
  }
}

function decayIntent(state: CombatEngineState, acted: { hit: boolean }) {
  const p = state.player
  if (p.classId !== 'sword') return
  const st = getStatus(p, 'sword_intent')
  if (!st) return
  if (!acted.hit) {
    st.stacks = Math.max(0, (st.stacks ?? 0) - 1)
    if ((st.stacks ?? 0) <= 0) removeStatus(p, 'sword_intent')
    else pushLog(state.log, `剑意衰减为 ×${st.stacks}。`, 'status')
  }
}

function demonBacklash(state: CombatEngineState) {
  const p = state.player
  if (p.classId !== 'demon') return
  const st = getStatus(p, 'sha_qi')
  if (!st || (st.stacks ?? 0) < 6) return
  if (Math.random() < 0.1) {
    const dmg = Math.max(1, Math.floor(p.maxHp * 0.04))
    p.hp = Math.max(1, p.hp - dmg)
    st.stacks = Math.max(0, (st.stacks ?? 0) - 2)
    pushLog(state.log, `煞气反噬！你气血逆冲，损失 ${dmg}，煞气 -2。`, 'status')
    if ((st.stacks ?? 0) <= 0) removeStatus(p, 'sha_qi')
  }
}

function talismanChargeTick(state: CombatEngineState) {
  const p = state.player
  if (p.classId !== 'talisman') return
  if (state.round % 3 !== 0) return
  const st = getStatus(p, 'talisman_charge')
  const stacks = (st?.stacks ?? 0) + 1
  if (stacks > 4) return
  addStatus(p, 'talisman_charge', 0)
  const s2 = getStatus(p, 'talisman_charge')
  if (s2) s2.stacks = stacks
  else p.statuses.push({ id: 'talisman_charge', stacks })
  pushLog(state.log, `袖里符凝聚，符能×${stacks}。`, 'status')
}

function checkEnd(state: CombatEngineState): boolean {
  const p = state.player
  const e = state.enemy
  const cfg = COMBAT_CONFIG
  if (e.hp <= 0) {
    state.finished = true
    state.win = true
    pushLog(state.log, `${e.name}倒下了。`, 'sys')
    return true
  }
  if (p.hp <= 0) {
    state.finished = true
    state.win = false
    pushLog(state.log, '你力竭倒地，仓皇撤出战场。', 'sys')
    return true
  }
  if (state.round >= cfg.maxRounds) {
    state.finished = true
    state.win = e.hp / e.maxHp < p.hp / p.maxHp
    pushLog(state.log, '缠斗许久，双方暂退。', 'sys')
    return true
  }
  return false
}

/** 执行一次玩家行动，并推进敌方回合（若战斗未结束） */
export function stepCombat(
  state: CombatEngineState,
  action: PlayerAction,
  inventory: Record<string, number>,
  playerRealm: RealmId,
  playerLayer: number,
): CombatEngineState {
  if (state.finished) return state
  const p = state.player
  const e = state.enemy
  const cfg = COMBAT_CONFIG
  const next = state
  next.round += 1
  talismanChargeTick(next)

  // tick statuses at round start
  tickStatuses(p, next.log, 'player')
  tickStatuses(e, next.log, 'enemy')

  const stunP = getStatus(p, 'stun')
  if (stunP?.turns && stunP.turns > 0) {
    stunP.turns = 0
    removeStatus(p, 'stun')
    pushLog(next.log, '你陷入眩晕，无法行动。', 'status')
    enemyAct(next)
    demonBacklash(next)
    checkEnd(next)
    return next
  }

  let hit = false
  let defending = false
  let lsOverride: number | undefined

  if (action.type === 'attack') {
    hit = true
    dealDamage(next, p, e, {
      multiplier: 1,
      defPierce: 1,
      label: `你对${e.name}`,
      kind: 'player',
      lifestealOverride: lsOverride,
    })
  } else if (action.type === 'defend') {
    defending = true
    const gain = cfg.defendEnergyRegen
    p.energy = Math.min(p.maxEnergy, p.energy + gain)
    pushLog(next.log, `你凝神防御，伤害大减，灵力 +${gain}。`, 'player')
  } else if (action.type === 'potion') {
    if (inventory[action.itemId] !== undefined || true) {
      const ok = tryPotion(next, action.itemId)
      if (!ok) pushLog(next.log, '无法服用该物品。', 'status')
      // store decrements inventory externally when action accepted
    }
  } else if (action.type === 'skill') {
    const skill = SKILLS[action.skillId]
    if (!skill || skill.type !== 'active' || skill.classId !== p.classId) {
      pushLog(next.log, '无法使用该技能。', 'status')
    } else if (!isSkillUnlocked(skill, playerRealm, playerLayer)) {
      pushLog(next.log, '境界不足，技能尚未领悟。', 'status')
    } else if ((p.skillCd[skill.id] ?? 0) > 0) {
      pushLog(next.log, `${skill.name}尚在调息（CD ${p.skillCd[skill.id]}）。`, 'status')
    } else if (!canPaySkill(next, skill)) {
      pushLog(next.log, `${p.isDemon ? '魔元' : '灵力'}不足，无法施展${skill.name}。`, 'status')
    } else {
      paySkill(next, skill)
      p.skillCd[skill.id] = skill.cd ?? 0
      const effects = skill.effects ?? []
      let extraMul = 1
      let pierce = skill.defPierce ?? 1
      let mul = skill.multiplier ?? 0
      const hits = skill.hits ?? 1
      hit = (mul ?? 0) > 0
      const shaBefore = skill.id === 'sk_demon_burst' ? statusStacks(p, 'sha_qi') : 0

      for (const eff of effects) {
        if (eff.type === 'consume_status' && eff.status) {
          const stacks = statusStacks(p, eff.status)
          if (stacks > 0 && eff.bonusPerStack) extraMul += stacks * eff.bonusPerStack
          removeStatus(p, eff.status)
          pushLog(next.log, `【${skill.name}】消耗${statusLabel(eff.status)}×${stacks}。`, 'status')
        }
        if (eff.type === 'shield') {
          const val = Math.floor(p.maxHp * (eff.ratio ?? 0.2))
          addStatus(p, 'shield', 0, eff.turns ?? 3, val)
          pushLog(next.log, `【${skill.name}】获得护盾 ${val}。`, 'status')
        }
        if (eff.type === 'heal') {
          const h = Math.floor(p.maxHp * (eff.ratio ?? 0)) + (eff.flat ?? 0)
          p.hp = Math.min(p.maxHp, p.hp + h)
          pushLog(next.log, `【${skill.name}】回复 ${h} 气血。`, 'heal')
        }
        if (eff.type === 'add_status' && eff.status) {
          const target = eff.target === 'enemy' ? e : p
          if (
            eff.status === 'stun' ||
            eff.status === 'weaken' ||
            eff.status === 'regen' ||
            eff.status === 'atk_up' ||
            eff.status === 'counter_buff'
          ) {
            addStatus(target, eff.status, 0, eff.turns ?? 1, eff.value)
          } else {
            addStatus(target, eff.status, eff.stacks ?? 1, eff.turns, eff.value)
          }
          if (eff.target === 'enemy' && eff.status === 'stun') {
            pushLog(next.log, `【${skill.name}】${e.name}陷入眩晕！`, 'status')
          }
        }
        if (eff.type === 'chance_status' && eff.status && Math.random() < (eff.chance ?? 0)) {
          const target = eff.target === 'enemy' ? e : p
          addStatus(target, eff.status, 0, eff.turns ?? 1)
          pushLog(next.log, `【${skill.name}】${target.name}陷入${statusLabel(eff.status)}！`, 'status')
        }
        if (eff.type === 'missing_hp_damage') {
          const missing = p.maxHp - p.hp
          let extra = Math.floor(missing * (eff.ratio ?? 0))
          const cap = Math.floor(effAtk(p) * (eff.capAtk ?? 1))
          extra = Math.min(extra, cap)
          if (extra > 0) {
            e.hp = Math.max(0, e.hp - extra)
            pushLog(next.log, `【${skill.name}】气血激荡，额外造成 ${extra} 点伤害。`, 'player')
          }
        }
        if (eff.type === 'cost_lifespan') {
          next.lifespanCost += eff.years ?? 1
          pushLog(next.log, `【${skill.name}】寿元 -${eff.years ?? 1}！`, 'status')
        }
        if (eff.type === 'lifesteal_override') {
          lsOverride = eff.ratio
        }
        if (eff.type === 'artifact_attack') {
          const hasAtk = p.treasures.some((t) => ATTACK_TREASURES.has(t))
          mul = hasAtk ? eff.strongMul ?? 2 : eff.weakMul ?? 1.4
          hit = true
          if (!hasAtk) pushLog(next.log, `法宝未至，${skill.name}威力受限。`, 'status')
        }
        if (eff.type === 'artifact_defend') {
          const hasDef = p.treasures.some((t) => DEF_TREASURES.has(t))
          const ratio = hasDef ? eff.strongRatio ?? 0.3 : eff.weakRatio ?? 0.15
          const val = Math.floor(p.maxHp * ratio)
          addStatus(p, 'shield', 0, eff.turns ?? 3, val)
          p.energy = Math.min(p.maxEnergy, p.energy + (eff.energyGain ?? 0))
          pushLog(next.log, `【${skill.name}】护盾 ${val}${hasDef ? '' : '（法宝未至）'}。`, 'status')
        }
        if (eff.type === 'consume_pill_blast') {
          const pid = pickBlastPillId(inventory)
          if (pid) {
            mul = blastMultiplier(pid)
            hit = true
            next.blastPillsUsed.push(pid)
            pushLog(next.log, `【爆丹】消耗${ITEMS[pid]?.name ?? pid}，倍率提升。`, 'player')
          } else {
            mul = 0
            hit = false
            pushLog(next.log, '【爆丹】背包无丹，气息散乱。', 'status')
          }
        }
        if (eff.type === 'bonus_if_status' && eff.status) {
          const target = eff.target === 'enemy' ? e : p
          if (getStatus(target, eff.status)) {
            extraMul += eff.multiplier ?? 0.6
          }
        }
      }

      if (skill.id === 'sk_demon_burst' && shaBefore >= 6) {
        addStatus(p, 'stun', 0, 1)
        pushLog(next.log, '煞气过盛，你气血逆冲，陷入眩晕！', 'status')
      }

      pushLog(next.log, `【${skill.name}】灵力/魔元消耗已结算。`, 'player')

      if (hit && (mul ?? 0) > 0) {
        for (let i = 0; i < hits; i++) {
          dealDamage(next, p, e, {
            multiplier: mul ?? 0,
            defPierce: pierce,
            label:
              hits > 1
                ? `【${skill.name}】第${i + 1}段，你对${e.name}`
                : `【${skill.name}】你对${e.name}`,
            kind: 'player',
            lifestealOverride: lsOverride,
            extraMul,
          })
          if (e.hp <= 0) break
        }
      }
    }
  }

  if (e.hp <= 0) {
    checkEnd(next)
    return next
  }

  if (defending) {
    // 防御回合：敌方攻击享受减伤
    const stun = getStatus(e, 'stun')
    if (stun?.turns && stun.turns > 0) {
      stun.turns = 0
      removeStatus(e, 'stun')
      pushLog(next.log, `${e.name}陷入眩晕，无法行动。`, 'status')
    } else {
      if (e.hp <= e.maxHp * 0.3 && !getStatus(e, 'enrage')) {
        addStatus(e, 'enrage')
        pushLog(next.log, `${e.name}双目赤红，陷入狂暴！`, 'enemy')
      }
      const eSkill = e.enemySkills[0]
      const chance = cfg.enemySkillChance[e.tier] ?? 0.25
      const cdLeft = eSkill ? e.skillCd[eSkill.id] ?? 0 : 99
      if (eSkill && cdLeft <= 0 && Math.random() < chance) {
        e.skillCd[eSkill.id] = eSkill.cd ?? 3
        dealDamage(next, e, p, {
          multiplier: eSkill.multiplier ?? 1,
          defPierce: eSkill.defPierce ?? 1,
          label: `${e.name}的${eSkill.name}`,
          kind: 'enemy',
          defending: true,
        })
      } else {
        dealDamage(next, e, p, {
          multiplier: 1,
          defPierce: 1,
          label: `${e.name}对你`,
          kind: 'enemy',
          defending: true,
        })
      }
    }
  } else if (!next.finished) {
    enemyAct(next)
  }

  decayIntent(next, { hit })
  demonBacklash(next)

  for (const k of Object.keys(e.skillCd)) {
    if (e.skillCd[k] > 0 && e.skillCd[k] < 90) e.skillCd[k] -= 1
  }
  for (const k of Object.keys(p.skillCd)) {
    if (p.skillCd[k] > 0) p.skillCd[k] -= 1
  }

  checkEnd(next)
  return next
}

export function combatResultFromState(state: CombatEngineState): CombatEngineResult {
  const e = state.context.enemy
  return {
    win: state.win,
    log: state.log,
    playerHpLeft: state.player.hp,
    playerEnergyLeft: state.player.energy,
    lifespanCost: state.lifespanCost,
    potionsUsed: state.potionsUsed,
    blastPillsUsed: state.blastPillsUsed,
    expGain: state.win ? e.loot.exp ?? 0 : 0,
    stoneGain: state.win ? e.loot.stone ?? 0 : 0,
    itemId: state.win ? e.loot.itemId : undefined,
    message: state.log[state.log.length - 1]?.text ?? '',
    rounds: state.round,
  }
}

/** 兼容旧调用的同步结算（自动战斗用完整引擎跑完） */
export function runCombatAuto(
  player: CombatActor,
  enemy: EnemyDef,
  context: CombatContext,
  inventory: Record<string, number>,
  playerRealm: RealmId,
  playerLayer: number,
  pickAction: (state: CombatEngineState) => PlayerAction,
): CombatEngineResult {
  let state = createCombatState(player, enemy, context)
  const cfg = COMBAT_CONFIG
  let guard = 0
  while (!state.finished && guard < cfg.maxRounds + 5) {
    guard += 1
    state = stepCombat(state, pickAction(state), inventory, playerRealm, playerLayer)
  }
  return combatResultFromState(state)
}

export function defaultAutoAction(
  state: CombatEngineState,
  inventory: Record<string, number>,
  playerRealm: RealmId,
  playerLayer: number,
): PlayerAction {
  const p = state.player
  const e = state.enemy
  if (!p.classId) return { type: 'attack' }

  // potion when low
  if (p.hp <= p.maxHp * 0.3 && p.potionsUsed < state.potionLimit) {
    const healId = Object.keys(inventory).find(
      (id) => (inventory[id] ?? 0) > 0 && ITEMS[id]?.effect?.hp && !ITEMS[id]?.effect?.breakthroughRate,
    )
    if (healId) return { type: 'potion', itemId: healId }
  }

  const skills = getUnlockedPlayerSkills(p.classId, playerRealm, playerLayer)
  const usable = skills.filter(
    (s) => (p.skillCd[s.id] ?? 0) <= 0 && canPaySkill(state, s),
  )

  // defensive / heal
  const healSkill = usable.find((s) => s.effects?.some((x) => x.type === 'heal' || x.type === 'shield'))
  if (p.hp <= p.maxHp * 0.25 && healSkill) return { type: 'skill', skillId: healSkill.id }

  // burst when enemy low or high priority
  const sorted = [...usable].sort((a, b) => (b.autoPriority ?? 0) - (a.autoPriority ?? 0))
  for (const s of sorted) {
    if (s.id === 'sk_sword_break' && statusStacks(p, 'sword_intent') < 4 && e.hp > e.maxHp * 0.35) continue
    if (s.id === 'sk_demon_burst' && statusStacks(p, 'sha_qi') < 5 && e.hp > e.maxHp * 0.35) continue
    if (s.id === 'sk_alchemy_blast' && e.hp <= e.maxHp * 0.4) continue
    if ((s.autoPriority ?? 0) >= 40) return { type: 'skill', skillId: s.id }
  }

  // defend if low energy
  const minCost = Math.min(...skills.map((s) => s.cost?.energy ?? 99))
  if (p.energy < minCost) return { type: 'defend' }

  return { type: 'attack' }
}

export function summaryStatusLine(actor: CombatActor): string {
  return `气血 ${actor.hp}/${actor.maxHp} · ${actor.isDemon ? '魔元' : '灵力'} ${actor.energy}/${actor.maxEnergy} · ${formatStatuses(actor)}`
}
