import { describe, expect, it } from 'vitest'
import { buildSaveFileName, describeSaveTimeline } from './reincarnate'

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
