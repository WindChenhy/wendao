import { GONGFAS, type GongfaKind } from './gongfa'
import synergyJson from './db/gongfa_synergy.json'

export type SynergyType = 'school_count' | 'kind_count' | 'mixed_faction' | 'combo'

export interface SynergyEffects {
  atk?: number
  def?: number
  hp?: number
  cultivate?: number
  dodge?: number
  /** 突破成功率百分点（可为负） */
  breakthrough?: number
}

export interface SynergyRule {
  id: string
  name: string
  desc: string
  type: SynergyType
  school?: string
  kind?: GongfaKind
  min?: number
  ids?: string[]
  effects: SynergyEffects
  flavor?: string
}

export const SYNERGY_RULES: SynergyRule[] = synergyJson.rules as SynergyRule[]

/** 功法所属脉系：宗门前缀派生；市井功法为 wandering */
export function gongfaSchool(id: string): string {
  if (id.startsWith('js_')) return 'qingyun'
  if (id.startsWith('ty_')) return 'taiyi'
  if (id.startsWith('ht_')) return 'haoti'
  if (id.startsWith('xs_')) return 'xuesha'
  if (id.startsWith('ym_')) return 'youming'
  return 'wandering'
}

export const SCHOOL_LABEL: Record<string, string> = {
  qingyun: '青云',
  taiyi: '太一',
  haoti: '浩天',
  xuesha: '血煞',
  youming: '幽冥',
  wandering: '市井',
}

const RIGHT_SCHOOLS = new Set(['qingyun', 'taiyi', 'haoti', 'wandering'])
const DEMON_SCHOOLS = new Set(['xuesha', 'youming'])

export interface ActiveSynergy {
  rule: SynergyRule
  /** 激活说明 */
  note: string
}

/** 按已参悟功法 id 列表判定激活羁绊 */
export function activeSynergies(learnedIds: string[]): ActiveSynergy[] {
  const ids = learnedIds.filter((id) => GONGFAS[id])
  const out: ActiveSynergy[] = []
  if (ids.length === 0) return out

  const schoolCount = new Map<string, number>()
  const kindCount = new Map<string, number>()
  let hasRight = false
  let hasDemon = false
  for (const id of ids) {
    const g = GONGFAS[id]
    const sch = gongfaSchool(id)
    schoolCount.set(sch, (schoolCount.get(sch) ?? 0) + 1)
    kindCount.set(g.kind, (kindCount.get(g.kind) ?? 0) + 1)
    if (RIGHT_SCHOOLS.has(sch)) hasRight = true
    if (DEMON_SCHOOLS.has(sch)) hasDemon = true
  }

  for (const rule of SYNERGY_RULES) {
    if (rule.type === 'school_count') {
      if (rule.school === 'any' || !rule.school) {
        // 任一脉系达到 min
        const hit = [...schoolCount.entries()].find(([, n]) => n >= (rule.min ?? 2))
        if (hit) {
          out.push({
            rule,
            note: `${SCHOOL_LABEL[hit[0]] ?? hit[0]}脉 ${hit[1]} 部`,
          })
        }
      } else {
        const sch = rule.school
        const n = schoolCount.get(sch) ?? 0
        if (n >= (rule.min ?? 2)) {
          out.push({
            rule,
            note: `${SCHOOL_LABEL[sch] ?? sch}脉 ${n} 部`,
          })
        }
      }
      continue
    }
    if (rule.type === 'kind_count') {
      const n = kindCount.get(rule.kind!) ?? 0
      if (n >= (rule.min ?? 3)) {
        out.push({ rule, note: `${rule.kind} ×${n}` })
      }
      continue
    }
    if (rule.type === 'mixed_faction') {
      if (hasRight && hasDemon) {
        out.push({ rule, note: '正魔并蓄' })
      }
      continue
    }
    if (rule.type === 'combo') {
      const need = rule.ids ?? []
      if (need.length > 0 && need.every((id) => ids.includes(id))) {
        out.push({ rule, note: '组合已成' })
      }
    }
  }
  return out
}

/** 羁绊总加成（可叠乘/加算 dodge 与 breakthrough） */
export function synergyBonus(learnedIds: string[]): Required<SynergyEffects> {
  const base = { atk: 0, def: 0, hp: 0, cultivate: 0, dodge: 0, breakthrough: 0 }
  for (const { rule } of activeSynergies(learnedIds)) {
    base.atk += rule.effects.atk ?? 0
    base.def += rule.effects.def ?? 0
    base.hp += rule.effects.hp ?? 0
    base.cultivate += rule.effects.cultivate ?? 0
    base.dodge += rule.effects.dodge ?? 0
    base.breakthrough += rule.effects.breakthrough ?? 0
  }
  return base
}

export function describeSynergyEffects(e: SynergyEffects): string {
  const parts: string[] = []
  if (e.atk) parts.push(`攻击 +${Math.round(e.atk * 100)}%`)
  if (e.def) parts.push(`防御 +${Math.round(e.def * 100)}%`)
  if (e.hp) parts.push(`气血 +${Math.round(e.hp * 100)}%`)
  if (e.cultivate) parts.push(`修炼 +${Math.round(e.cultivate * 100)}%`)
  if (e.dodge) parts.push(`受伤降低 ${Math.round(e.dodge * 100)}%`)
  if (e.breakthrough) {
    parts.push(`突破 ${e.breakthrough > 0 ? '+' : ''}${e.breakthrough}%`)
  }
  return parts.join('、') || '—'
}
