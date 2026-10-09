import { COMPANIONS } from './companions'
import codexDb from './db/codex.json'
import { ENEMY_TEMPLATES } from './enemies'
import { GONGFA_LIST } from './gongfa'
import { ITEMS, itemCategory } from './items'
import { REALMS, REALM_ORDER } from './realms'
import { SECRET_REALMS } from './secretRealms'
import type { CollectionState } from '../types'

export type CodexPageId = 'realm' | 'enemy' | 'gongfa' | 'item' | 'companion' | 'secret'

interface CodexEntry {
  id: string
  name: string
  desc: string
  meta?: string
}

interface CodexPageReward {
  stones?: number
  daoMarks?: number
  title?: string
}

/** 各图鉴页集齐进度节点（%）与奖励 */
export const CODEX_MILESTONES = [25, 50, 75, 100] as const

/** 图鉴页元数据：src/data/db/codex.json */
export const CODEX_PAGE_META: Record<
  CodexPageId,
  { name: string; desc: string; rewards: Record<number, CodexPageReward> }
> = codexDb as Record<
  CodexPageId,
  { name: string; desc: string; rewards: Record<number, CodexPageReward> }
>

const FACTION_LABEL: Record<string, string> = {
  righteous: '正道',
  demonic: '魔道',
  beast: '妖兽',
  abomination: '异类',
}

export function codexEntries(page: CodexPageId): CodexEntry[] {
  switch (page) {
    case 'realm':
      return REALM_ORDER.map((id) => ({
        id,
        name: REALMS[id].name,
        desc:
          id === 'ascended'
            ? '超脱此界，举霞飞升。'
            : `共 ${REALMS[id].layers} 层，突破后寿元约 ${REALMS[id].lifespan} 年。`,
      }))
    case 'enemy':
      return ENEMY_TEMPLATES.map((t) => ({
        id: t.id,
        name: t.name,
        desc: t.flavor,
        meta: FACTION_LABEL[t.faction] ?? t.faction,
      }))
    case 'gongfa':
      return GONGFA_LIST.map((g) => ({
        id: g.id,
        name: g.name,
        desc: g.desc,
        meta: `${g.grade} · ${g.kind}`,
      }))
    case 'item':
      return Object.values(ITEMS)
        .filter(
          (i) =>
            i.id.startsWith('pill_') || itemCategory(i.id) === 'treasure' || i.id.startsWith('mat_'),
        )
        .map((i) => ({
          id: i.id,
          name: i.name,
          desc: i.desc,
          meta: i.id.startsWith('pill_')
            ? '丹药'
            : itemCategory(i.id) === 'treasure'
              ? '法宝'
              : '材料',
        }))
    case 'companion': {
      const base = COMPANIONS.map((c) => ({
        id: c.id,
        name: c.name,
        desc: c.hidden ? (c.unlockHint ?? c.desc) : c.desc,
        meta: c.hidden ? '隐藏道侣' : c.title,
      }))
      const endings: CodexEntry[] = COMPANIONS.flatMap((c) => {
        const beats = c.postStory ?? []
        const hasHe = beats.some((b) => (b.choices ?? []).some((ch) => ch.ending === 'he') || b.ending === 'he')
        const hasBe = beats.some((b) => (b.choices ?? []).some((ch) => ch.ending === 'be') || b.ending === 'be')
        const out: CodexEntry[] = []
        if (hasHe) {
          out.push({
            id: `${c.id}_he`,
            name: `${c.name}·良缘`,
            desc: `${c.name}结缘线圆满结局。`,
            meta: '结局',
          })
        }
        if (hasBe) {
          out.push({
            id: `${c.id}_be`,
            name: `${c.name}·遗恨`,
            desc: `${c.name}结缘线遗憾结局。`,
            meta: '结局',
          })
        }
        return out
      })
      return [...base, ...endings]
    }
    case 'secret':
      return SECRET_REALMS.map((r) => ({
        id: r.id,
        name: r.name,
        desc: r.desc,
        meta: `共 ${r.floors} 层`,
      }))
  }
}

export const CODEX_PAGE_IDS: CodexPageId[] = [
  'realm',
  'enemy',
  'gongfa',
  'item',
  'companion',
  'secret',
]

export function emptyCollection(): CollectionState {
  return { realm: [], enemy: [], gongfa: [], item: [], companion: [], secret: [] }
}

export function collectionProgress(page: CodexPageId, collection: CollectionState): {
  unlocked: number
  total: number
  percent: number
} {
  const total = codexEntries(page).length
  const unlocked = collection[page]?.length ?? 0
  return {
    unlocked,
    total,
    percent: total <= 0 ? 0 : Math.floor((unlocked / total) * 100),
  }
}

export function codexRewardKey(page: CodexPageId, pct: number): string {
  return `${page}:${pct}`
}

export function describeCodexReward(r: CodexPageReward): string {
  const parts: string[] = []
  if (r.stones) parts.push(`灵石 +${r.stones}`)
  if (r.daoMarks) parts.push(`道痕 +${r.daoMarks}`)
  if (r.title) parts.push(`称号「${r.title}」`)
  return parts.join(' · ')
}

/** 待领取的图鉴节点（按百分比阈值，且未领取） */
export function pendingCodexRewards(
  collection: CollectionState,
  claimed: string[],
): { page: CodexPageId; pct: number; reward: CodexPageReward }[] {
  const out: { page: CodexPageId; pct: number; reward: CodexPageReward }[] = []
  for (const page of CODEX_PAGE_IDS) {
    const { percent } = collectionProgress(page, collection)
    for (const pct of CODEX_MILESTONES) {
      if (percent >= pct && !claimed.includes(codexRewardKey(page, pct))) {
        const reward = CODEX_PAGE_META[page].rewards[pct]
        if (reward) out.push({ page, pct, reward })
      }
    }
  }
  return out
}
