import { beforeAll, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { APTITUDE_LIST } from '../data/aptitudes'
import { ORIGIN_LIST } from '../data/origins'

// 面板订阅 store，store 模块加载时会读 localStorage → 必须先桩掉，再动态 import 面板
vi.stubGlobal('localStorage', {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
})

type CreateCharacterComponent = typeof import('./CreateCharacter').CreateCharacter
type StoreModule = typeof import('../stores/useGameStore')

let CreateCharacter: CreateCharacterComponent
let useGameStore: StoreModule['useGameStore']

beforeAll(async () => {
  useGameStore = (await import('../stores/useGameStore')).useGameStore
  CreateCharacter = (await import('./CreateCharacter')).CreateCharacter
})

/**
 * 创角页渲染烟测（SSR）：防止新创角流程出现运行时空引用白屏。
 * 仅覆盖创角页 —— zustand v5 的 SSR 快照取自 store 初始状态，
 * 任何依赖 `player` 的面板在 node 环境下必然渲染为空（需 DOM 环境才能测，本仓库未装 jsdom）。
 * 「立道后的人物页/修炼页」行为改由 src/stores/pathFlow.test.ts 的 store 级端到端测试覆盖。
 *
 * 灵根与出身改为天命随机（每卷 4 选 1、共 5 卷）后，
 * 具体灵根/出身名不再全量出现，改为断言组合卡数量与随机文案。
 */
describe('创角页渲染烟测', () => {
  it('天命随机：每卷给出 4 个组合卡，首卷后余 4 次重掷', () => {
    useGameStore.getState().backToMenu()
    useGameStore.getState().startCreate()
    const html = renderToStaticMarkup(createElement(CreateCharacter))
    // 首卷已随机，重掷按钮显示剩余次数（单表达式文本节点，SSR 不插注释）
    expect(html).toContain('重掷天命（余 4 次）')
    expect(html).toContain('共 5 卷')
    // 每张组合卡各有一条起始盘缠 → 恰好 4 张卡
    expect((html.match(/灵石 /g) ?? []).length).toBe(4)
    // 至少含一个真实灵根名与一个真实出身名
    expect(APTITUDE_LIST.some((a) => html.includes(a.name)), '应出现灵根名').toBe(true)
    expect(ORIGIN_LIST.some((o) => html.includes(o.name)), '应出现出身名').toBe(true)
    expect(html).not.toContain('主职业')
  })

  it('烟测：关键引导文案齐备', () => {
    useGameStore.getState().backToMenu()
    useGameStore.getState().startCreate()
    const html = renderToStaticMarkup(createElement(CreateCharacter))
    expect(html).toContain('道途不在此处定下')
    expect(html).toContain('天道掷卷')
    expect(html).toContain('踏入仙途')
  })
})
