import { describe, expect, it } from 'vitest'
import {
  CODEX_PAGE_IDS,
  CODEX_PAGE_META,
  codexEntries,
  codexRewardKey,
  emptyCollection,
  pendingCodexRewards,
} from './codex'

describe('R-17 图鉴奖励分页差异化', () => {
  it('各页条目数已知且与阶梯档位匹配', () => {
    // 条目少的页（固定枚举）
    expect(codexEntries('realm')).toHaveLength(10)
    expect(codexEntries('secret')).toHaveLength(12)
    // 条目多的页（下界守卫，防止误删表条目而阶梯失配）
    expect(codexEntries('enemy').length).toBeGreaterThanOrEqual(27)
    expect(codexEntries('gongfa').length).toBeGreaterThanOrEqual(100)
    expect(codexEntries('item').length).toBeGreaterThanOrEqual(70)
    expect(codexEntries('companion').length).toBeGreaterThanOrEqual(8)
  })

  it('每页节点严格递增、末档为 100、且均在 (0,100] 内', () => {
    for (const page of CODEX_PAGE_IDS) {
      const ms = CODEX_PAGE_META[page].milestones
      expect(ms.length, `${page} 至少要有两档节点`).toBeGreaterThanOrEqual(2)
      expect(ms[ms.length - 1], `${page} 末档必须是 100%`).toBe(100)
      for (let i = 0; i < ms.length; i++) {
        expect(ms[i], `${page} 节点越界`).toBeGreaterThan(0)
        expect(ms[i], `${page} 节点超过 100`).toBeLessThanOrEqual(100)
        if (i > 0) expect(ms[i], `${page} 节点未严格递增`).toBeGreaterThan(ms[i - 1])
      }
    }
  })

  it('每个节点都配置了非空奖励', () => {
    for (const page of CODEX_PAGE_IDS) {
      for (const pct of CODEX_PAGE_META[page].milestones) {
        const r = CODEX_PAGE_META[page].rewards[pct]
        expect(r, `${page}@${pct}% 缺奖励配置`).toBeTruthy()
        expect(
          Boolean(r?.stones || r?.daoMarks || r?.title),
          `${page}@${pct}% 奖励为空`,
        ).toBe(true)
      }
    }
  })

  it('条目越多的页档位数与集齐道痕越厚（难度与收益成正比）', () => {
        const nodesOf = (p: (typeof CODEX_PAGE_IDS)[number]) =>
          CODEX_PAGE_META[p].milestones.length
    const fullMarksOf = (p: (typeof CODEX_PAGE_IDS)[number]) =>
      CODEX_PAGE_META[p].rewards[100]?.daoMarks ?? 0
    // 小页 3~4 档
    expect(nodesOf('realm')).toBe(3)
    expect(nodesOf('companion')).toBe(3)
    expect(nodesOf('secret')).toBe(4)
    // 大页 5 档
    expect(nodesOf('enemy')).toBe(5)
    expect(nodesOf('gongfa')).toBe(5)
    expect(nodesOf('item')).toBe(5)
    // 功法 103 条，集齐道痕最厚；境界仅 10 条，最薄
    expect(fullMarksOf('gongfa')).toBeGreaterThan(fullMarksOf('realm'))
    expect(fullMarksOf('gongfa')).toBeGreaterThan(fullMarksOf('secret'))
    expect(fullMarksOf('enemy')).toBeGreaterThanOrEqual(fullMarksOf('realm'))
  })

  it('集齐某页时待领列表给出该页全部节点奖励', () => {
    const collection = emptyCollection()
    // 境界页全解锁
    collection.realm = codexEntries('realm').map((e) => e.id)
    const pending = pendingCodexRewards(collection, [])
    const realmHits = pending.filter((h) => h.page === 'realm')
    expect(realmHits.map((h) => h.pct)).toEqual([30, 60, 100])
    expect(realmHits[2].reward.title).toBe('天道见证')
    // 领取后不再重复出现
    const claimed = realmHits.map((h) => codexRewardKey(h.page, h.pct))
    expect(pendingCodexRewards(collection, claimed)).toHaveLength(0)
  })
})
