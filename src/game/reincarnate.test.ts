import { describe, expect, it } from 'vitest'
import {
  buildSaveFileName,
  describeSaveTimeline,
  FAVOR_DAO_CAP,
  FAVOR_DAO_RATIO,
  reincarnateGain,
} from './reincarnate'
import type { PlayerState } from '../types'

function playerOf(realm: PlayerState['realm'], age = 20): PlayerState {
  return {
    name: '测试',
    gender: 'male',
    classId: 'sword',
    realm,
    layer: 1,
    exp: 0,
    hp: 1,
    maxHp: 1,
    energy: 1,
    maxEnergy: 1,
    shaqi: 0,
    age,
    lifespanLeft: 10,
    repRight: 0,
    repDemonic: 0,
    alive: true,
    ascended: realm === 'ascended',
  }
}

describe('存档导出文件名', () => {
  it('普通名：存档_名_第X年M月D日.wdsave', () => {
    expect(buildSaveFileName({ name: '云无羁', year: 5, month: 3, day: 12, reincarnations: 0 })).toBe(
      '存档_云无羁_第5年3月12日.wdsave',
    )
  })

  it('转生次数 >0：带「_转生N次」且年号标为「本世第」', () => {
    expect(buildSaveFileName({ name: '云无羁', year: 5, month: 3, day: 12, reincarnations: 2 })).toBe(
      '存档_云无羁_转生2次_本世第5年3月12日.wdsave',
    )
  })

  it('名字含 Windows 非法字符 \\ / : * ? " < > | 被过滤（v1.3）', () => {
    const name = 'a/b\\c:d*e?f"g<h>i|j'
    const file = buildSaveFileName({ name, year: 1, month: 1, day: 1, reincarnations: 0 })
    expect(file).toBe('存档_abcdefghij_第1年1月1日.wdsave')
    for (const ch of ['\\', '/', ':', '*', '?', '"', '<', '>', '|']) {
      expect(file).not.toContain(ch)
    }
  })
})

describe('导出备注 describeSaveTimeline', () => {
  it('未转生：首次修行、年号连续', () => {
    const text = describeSaveTimeline({ reincarnations: 0, year: 5, age: 30, totalYears: 0, lastLifeEndYear: 0 })
    expect(text).toContain('尚未转生')
    expect(text).toContain('第5年')
    expect(text).toContain('寿龄 30')
    expect(text).not.toContain('本世')
  })

  it('已转生：转生次数、本世年号、累计寿龄与上一世结束年', () => {
    const text = describeSaveTimeline({ reincarnations: 2, year: 3, age: 25, totalYears: 60, lastLifeEndYear: 12 })
    expect(text).toContain('已转生 2 次')
    expect(text).toContain('本世第3年')
    expect(text).toContain('本世寿龄 25')
    expect(text).toContain('历代累计寿龄约 85')
    expect(text).toContain('上一世结束于第12年')
  })
})

describe('v1.4 仙缘折算 reincarnateGain', () => {
  it('每 10 点仙缘 +1 道痕并写入说明', () => {
    const base = reincarnateGain(playerOf('ascended'), false, 0)
    const withFavor = reincarnateGain(playerOf('ascended'), false, 100)
    expect(withFavor.daoMarks - base.daoMarks).toBe(10)
    expect(withFavor.desc).toContain('仙缘 +10')
  })

  it('仙缘折道痕上限 +30（防刷）', () => {
    const gain = reincarnateGain(playerOf('ascended'), false, 999999)
    expect(FAVOR_DAO_CAP).toBe(30)
    expect(gain.daoMarks - reincarnateGain(playerOf('ascended'), false, 0).daoMarks).toBe(30)
    expect(FAVOR_DAO_RATIO).toBe(10)
  })

  it('仙缘不足 10 不折算；负值安全处理', () => {
    expect(reincarnateGain(playerOf('ascended'), false, 9).desc).not.toContain('仙缘')
    expect(reincarnateGain(playerOf('ascended'), false, -50).daoMarks).toBe(
      reincarnateGain(playerOf('ascended'), false, 0).daoMarks,
    )
  })

  it('不传 favor 时与旧签名结果一致（向后兼容）', () => {
    const p = playerOf('golden_core')
    expect(reincarnateGain(p, true).daoMarks).toBe(reincarnateGain(p, true, 0).daoMarks)
  })
})
