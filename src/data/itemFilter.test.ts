import { describe, expect, it } from 'vitest'
import { ITEMS } from './items'
import { GONGFAS } from './gongfa'
import {
  itemRealmNeed,
  matchesName,
  matchesRealm,
  REALM_FILTER_OPTIONS,
} from './itemFilter'

/** 取一本真实的坊市秘籍 id（scroll_<功法id>） */
const scrollId = (() => {
  const gid = Object.keys(GONGFAS)[0]!
  return `scroll_${gid}`
})()

describe('背包/坊市搜索与境界筛选', () => {
  it('秘籍的境界门槛取功法 minRealm，而非物品自身', () => {
    const gid = scrollId.slice('scroll_'.length)
    expect(itemRealmNeed(scrollId)).toBe(GONGFAS[gid]!.minRealm)
  })

  it('名称搜索：空串放行，命中子串', () => {
    const id = 'pill_heal'
    const name = ITEMS[id]!.name
    expect(matchesName(id, '')).toBe(true)
    expect(matchesName(id, name)).toBe(true)
    expect(matchesName(id, name.slice(0, 1))).toBe(true)
    expect(matchesName(id, '这个名字一定不存在')).toBe(false)
  })

  it('境界筛选：all 全放行；none 只留无门槛条目', () => {
    expect(matchesRealm('pill_heal', 'all', 'qi')).toBe(true)
    const noGate = Object.keys(ITEMS).find(
      (id) => !id.startsWith('scroll_') && !ITEMS[id]!.minRealm,
    )
    if (noGate) {
      expect(matchesRealm(noGate, 'none', 'mahayana')).toBe(true)
      expect(matchesRealm(noGate, 'qi', 'mahayana')).toBe(false)
    }
  })

  it('境界筛选：指定境界＝需求境界正好是它', () => {
    const gid = scrollId.slice('scroll_'.length)
    const need = GONGFAS[gid]!.minRealm
    expect(matchesRealm(scrollId, need, 'qi')).toBe(true)
    // 换个境界即不匹配（除非恰好同门槛，故用不同门槛断言其中一方为 false）
    const other = need === 'qi' ? 'mahayana' : 'qi'
    expect(matchesRealm(scrollId, other, 'qi')).toBe(need === other)
  })

  it('境界筛选：fit 严格按当前境界（练气看不了大乘秘籍）', () => {
    const lateScroll = Object.keys(GONGFAS)
      .map((gid) => `scroll_${gid}`)
      .find((sid) => {
        const g = GONGFAS[sid.slice('scroll_'.length)]!
        return g.minRealm === 'mahayana'
      })
    if (lateScroll) {
      expect(matchesRealm(lateScroll, 'fit', 'qi')).toBe(false)
      expect(matchesRealm(lateScroll, 'fit', 'mahayana')).toBe(true)
    }
  })

  it('筛选下拉含「不限/当前可用/无门槛」及各可修行境界', () => {
    const values = REALM_FILTER_OPTIONS.map((o) => o.value)
    expect(values).toContain('all')
    expect(values).toContain('fit')
    expect(values).toContain('none')
    expect(values).toContain('qi')
    expect(values).not.toContain('ascended')
  })
})
