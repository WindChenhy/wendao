import { COMPANIONS } from './companions'
import { ENEMY_TEMPLATES } from './enemies'
import { GONGFA_LIST } from './gongfa'
import { ITEMS } from './items'
import { REALMS, REALM_ORDER } from './realms'
import { SECRET_REALMS } from './secretRealms'
import type { CollectionState } from '../types'

export type CodexPageId = 'realm' | 'enemy' | 'gongfa' | 'item' | 'companion' | 'secret'

export interface CodexEntry {
  id: string
  name: string
  desc: string
  meta?: string
}

export interface CodexPageReward {
  stones?: number
  daoMarks?: number
  title?: string
}

/** 各图鉴页集齐进度节点（%）与奖励 */
export const CODEX_MILESTONES = [25, 50, 75, 100] as const

export const CODEX_PAGE_META: Record<
  CodexPageId,
  { name: string; desc: string; rewards: Record<number, CodexPageReward> }
> = {
  realm: {
    name: '境界',
    desc: '曾抵达的大境界',
    rewards: {
      25: { stones: 50 },
      50: { stones: 150, daoMarks: 2 },
      75: { daoMarks: 6 },
      100: { daoMarks: 12, title: '天道见证' },
    },
  },
  enemy: {
    name: '敌人',
    desc: '历练/秘境遭遇并获胜的敌手',
    rewards: {
      25: { stones: 40 },
      50: { stones: 120 },
      75: { daoMarks: 3 },
      100: { daoMarks: 8, title: '百战之身' },
    },
  },
  gongfa: {
    name: '功法',
    desc: '曾参悟的功法',
    rewards: {
      25: { stones: 80 },
      50: { stones: 200, daoMarks: 2 },
      75: { daoMarks: 5 },
      100: { daoMarks: 10, title: '道藏知音' },
    },
  },
  item: {
    name: '丹药法宝',
    desc: '曾持有或服用的丹药、材料与法宝',
    rewards: {
      25: { stones: 60 },
      50: { stones: 160 },
      75: { daoMarks: 3 },
      100: { daoMarks: 8, title: '百宝阁主' },
    },
  },
  companion: {
    name: '道侣',
    desc: '曾结交的道侣',
    rewards: {
      25: { stones: 50 },
      50: { stones: 120, daoMarks: 2 },
      75: { daoMarks: 4 },
      100: { daoMarks: 8, title: '红尘知己' },
    },
  },
  secret: {
    name: '秘境',
    desc: '曾踏入的秘境',
    rewards: {
      25: { stones: 80 },
      50: { stones: 200, daoMarks: 2 },
      75: { daoMarks: 5 },
      100: { daoMarks: 10, title: '秘境行者' },
    },
  },
}

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
            i.id.startsWith('pill_') || i.id.startsWith('treasure_') || i.id.startsWith('mat_'),
        )
        .map((i) => ({
          id: i.id,
          name: i.name,
          desc: i.desc,
          meta: i.id.startsWith('pill_')
            ? '丹药'
            : i.id.startsWith('treasure_')
              ? '法宝'
              : '材料',
        }))
    case 'companion':
      return COMPANIONS.map((c) => ({
        id: c.id,
        name: c.name,
        desc: c.desc,
        meta: c.title,
      }))
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
