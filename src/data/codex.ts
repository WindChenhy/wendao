import { COMPANIONS } from './companions'
import codexDb from './db/codex.json'
import { ENEMY_TEMPLATES } from './enemies'
import { GONGFA_LIST } from './gongfa'
import { ITEMS, itemCategory } from './items'
import { ASCENSION_REALM, REALMS, REALM_ORDER } from './realms'
import { SECRET_REALMS } from './secretRealms'
import { describeRewardParts } from '../game/reward'
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

/**
 * 图鉴页元数据：src/data/db/codex.json
 *
 * R-17：奖励节点按各页条目数差异化——条目少的页（境界 10、秘境 12、道侣约 10）
 * 仅 3~4 档薄赏；条目多的页（敌人 27、丹药法宝约 100、功法 103）设 5 档、
 * 集齐道痕更厚，使「集齐难度」与条目数成正比。milestones 必须升序且末档为 100。
 */
export const CODEX_PAGE_META: Record<
  CodexPageId,
  {
    name: string
    desc: string
    milestones: number[]
    rewards: Record<number, CodexPageReward>
  }
> = codexDb as Record<
  CodexPageId,
  {
    name: string
    desc: string
    milestones: number[]
    rewards: Record<number, CodexPageReward>
  }
>

/**
 * 阵营中文标签（图鉴展示用）。
 * 新增 Faction 值时必须同步此表，否则图鉴会直接显示英文枚举名。
 */
export const FACTION_LABEL: Record<string, string> = {
  righteous: '正道',
  demonic: '魔道',
  beast: '妖兽',
  abomination: '异类',
  rogue: '邪修',
}

/** 图鉴条目按页缓存：内容全静态，页面每次渲染重建整张表纯属浪费（P2-8） */
const ENTRIES_CACHE = new Map<CodexPageId, CodexEntry[]>()

export function codexEntries(page: CodexPageId): CodexEntry[] {
  const cached = ENTRIES_CACHE.get(page)
  if (cached) return cached
  const list = buildCodexEntries(page)
  ENTRIES_CACHE.set(page, list)
  return list
}

function buildCodexEntries(page: CodexPageId): CodexEntry[] {
  switch (page) {
    case 'realm':
      return REALM_ORDER.map((id) => ({
        id,
        name: REALMS[id].name,
        desc:
          id === ASCENSION_REALM
            ? '超脱此界，举霞飞升。修为已满，此后只余仙缘可聚。'
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
              : '灵材',
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
  return describeRewardParts(r)
}

/** 待领取的图鉴节点（按百分比阈值，且未领取） */
export function pendingCodexRewards(
  collection: CollectionState,
  claimed: string[],
): { page: CodexPageId; pct: number; reward: CodexPageReward }[] {
  const out: { page: CodexPageId; pct: number; reward: CodexPageReward }[] = []
  for (const page of CODEX_PAGE_IDS) {
    const { percent } = collectionProgress(page, collection)
    for (const pct of CODEX_PAGE_META[page].milestones) {
      if (percent >= pct && !claimed.includes(codexRewardKey(page, pct))) {
        const reward = CODEX_PAGE_META[page].rewards[pct]
        if (reward) out.push({ page, pct, reward })
      }
    }
  }
  return out
}
