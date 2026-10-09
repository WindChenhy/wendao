import { describe, expect, it } from 'vitest'
import { migrateLegacy, migrateSect, migrateCompanion, mergeCollection, uniqIds } from '../stores/saveMigrate'

describe('存档迁移', () => {
  it('legacy 补 sealed 且数值归一', () => {
    const l = migrateLegacy({ daoMarks: '12', sealed: [{ kind: 'gongfa', id: 'gf_x', name: 'X' }] })
    expect(l.daoMarks).toBe(12)
    expect(l.sealed).toHaveLength(1)
    expect(l.sealed[0].kind).toBe('gongfa')
  })

  it('sect 旧 rank 映射并补任务链字段', () => {
    const s = migrateSect({ rank: 'disciple', sectId: 'qingyun', contribution: 5 })
    expect(s.rank).toBe('outer')
    expect(s.quest).toBeNull()
    expect(s.libraryLv).toBe(0)
  })

  it('companion 兼容缺字段', () => {
    const c = migrateCompanion({ affinity: { lin_wan: 10 }, spouseId: 'lin_wan' })
    expect(c.affinity.lin_wan).toBe(10)
    expect(c.spouseId).toBe('lin_wan')
    expect(c.endings).toEqual({})
  })

  it('mergeCollection 去重合并', () => {
    const m = mergeCollection(
      { realm: ['qi'], enemy: [], gongfa: [], item: [], companion: [], secret: [] },
      { realm: ['qi', 'foundation'], item: ['pill_qi'] },
    )
    expect(m.realm).toEqual(['qi', 'foundation'])
    expect(m.item).toEqual(['pill_qi'])
    expect(uniqIds(['a', 'a', ''])).toEqual(['a'])
  })
})
