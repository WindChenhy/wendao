import { describe, expect, it } from 'vitest'
import {
  decryptSnapshotJson,
  migrateLegacy,
  migrateSect,
  migrateCompanion,
  migrateMeta,
  mergeCollection,
  uniqIds,
} from '../stores/saveMigrate'
import type { PlayerState, SlotSnapshot } from '../types'

/** 最小可读存档：旧档（saveVersion 16）的 player 只有 classId，没有 paths/aptitude/origin */
function snapshotWith(player: Partial<PlayerState>): SlotSnapshot {
  return {
    version: 16,
    time: { year: 1, month: 1, day: 1 },
    player: {
      name: '旧档',
      gender: 'male',
      classId: 'sword',
      realm: 'qi',
      layer: 1,
      exp: 0,
      hp: 10,
      maxHp: 10,
      energy: 5,
      maxEnergy: 5,
      shaqi: 0,
      age: 16,
      lifespanLeft: 100,
      repRight: 0,
      repDemonic: 0,
      alive: true,
      ascended: false,
      ...player,
    },
    stones: 0,
    inventory: {},
    sect: {},
    treasures: [],
    artifacts: [],
    companion: {},
    gongfa: { learned: {} },
    towerBest: {},
    abode: {},
    legacy: {},
    updatedAt: 0,
  } as unknown as SlotSnapshot
}

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

  it('companion 兼容缺字段（旧档单道侣 → spouseIds）', () => {
    const c = migrateCompanion({ affinity: { lin_wan: 10 }, spouseId: 'lin_wan' })
    expect(c.affinity.lin_wan).toBe(10)
    expect(c.spouseIds).toEqual(['lin_wan'])
    expect(c.swornIds).toEqual([])
    expect(c.endings).toEqual({})
  })

  it('旧档男性道侣按新规则转为结拜', () => {
    const c = migrateCompanion({ spouseId: 'yan_luo' })
    expect(c.spouseIds).toEqual([])
    expect(c.swornIds).toEqual(['yan_luo'])
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

describe('v1.5 道途字段迁移（旧档 → 主修）', () => {
  it('旧档所选职业升格为主修，兼修列表为空', () => {
    const snap = decryptSnapshotJson(JSON.stringify(snapshotWith({ classId: 'demon' })))
    expect(snap?.player.classId).toBe('demon')
    expect(snap?.player.paths).toEqual([])
  })

  it('缺省灵根/出身回退为中性值（不改变旧档数值）', () => {
    const snap = decryptSnapshotJson(JSON.stringify(snapshotWith({})))
    expect(snap?.player.aptitude).toBe('mixed')
    expect(snap?.player.origin).toBe('wild')
  })

  it('非法 classId 收敛为未择道，非法兼修项被剔除且不与主修重复', () => {
    const snap = decryptSnapshotJson(
      JSON.stringify(
        snapshotWith({
          classId: 'not_a_path' as PlayerState['classId'],
          paths: ['body', 'body', 'bogus', 'sword'] as PlayerState['paths'],
          aptitude: 'bogus' as PlayerState['aptitude'],
          origin: 'bogus' as PlayerState['origin'],
        }),
      ),
    )
    expect(snap?.player.classId).toBe('none')
    expect(snap?.player.paths).toEqual(['body', 'sword'])
    expect(snap?.player.aptitude).toBe('mixed')
    expect(snap?.player.origin).toBe('wild')
  })

  it('新档兼修列表保留，主修不与兼修重复', () => {
    const snap = decryptSnapshotJson(
      JSON.stringify(snapshotWith({ classId: 'sword', paths: ['alchemy', 'sword', 'soul'] })),
    )
    expect(snap?.player.classId).toBe('sword')
    expect(snap?.player.paths).toEqual(['alchemy', 'soul'])
  })

  it('meta 统计补齐 v1.5 新增计数（旧档不报 NaN）', () => {
    const meta = migrateMeta({ stats: { combatsWon: 3, pillsCrafted: 2 } })
    expect(meta.stats.combatsWon).toBe(3)
    expect(meta.stats.combatsLost).toBe(0)
    expect(meta.stats.artifactsForged).toBe(0)
  })
})

describe('v18 心魔值/立场迁移（R-24/R-31）', () => {
  it('旧档无心魔字段：普通道途为 0，已立禁忌道途补记 20 点心魔债', () => {
    const sword = decryptSnapshotJson(JSON.stringify(snapshotWith({ classId: 'sword' })))
    expect(sword?.player.heartDemon).toBe(0)

    const demonPrimary = decryptSnapshotJson(JSON.stringify(snapshotWith({ classId: 'demon' })))
    expect(demonPrimary?.player.heartDemon).toBe(20)

    const soulSecondary = decryptSnapshotJson(
      JSON.stringify(snapshotWith({ classId: 'sword', paths: ['soul'] })),
    )
    expect(soulSecondary?.player.heartDemon).toBe(20)
  })

  it('已有心魔字段被夹取到 0–100（损坏值不传播）', () => {
    const high = decryptSnapshotJson(
      JSON.stringify(snapshotWith({ classId: 'sword', heartDemon: 999 })),
    )
    expect(high?.player.heartDemon).toBe(100)
    const neg = decryptSnapshotJson(
      JSON.stringify(snapshotWith({ classId: 'sword', heartDemon: -50 })),
    )
    expect(neg?.player.heartDemon).toBe(0)
  })

  it('已有心魔的旧档不会被禁忌补记覆盖（如 5 点保留）', () => {
    const snap = decryptSnapshotJson(
      JSON.stringify(snapshotWith({ classId: 'demon', heartDemon: 5 })),
    )
    expect(snap?.player.heartDemon).toBe(5)
  })

  it('alignment 仅接受合法枚举；缺省/非法时删除，交由声望推导', () => {
    const good = decryptSnapshotJson(
      JSON.stringify(snapshotWith({ classId: 'sword', alignment: 'demonic' })),
    )
    expect(good?.player.alignment).toBe('demonic')

    const bad = decryptSnapshotJson(
      JSON.stringify(snapshotWith({ classId: 'sword', alignment: 'chaotic' as PlayerState['alignment'] })),
    )
    expect(bad?.player.alignment).toBeUndefined()

    const absent = decryptSnapshotJson(JSON.stringify(snapshotWith({ classId: 'sword' })))
    expect(absent?.player.alignment).toBeUndefined()
  })
})
