import { beforeAll, describe, expect, it, vi } from 'vitest'

// store 模块加载时会读 localStorage → 必须先桩，再动态 import
vi.stubGlobal('localStorage', {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
})

type StoreModule = typeof import('./useGameStore')

let useGameStore: StoreModule['useGameStore']

beforeAll(async () => {
  useGameStore = (await import('./useGameStore')).useGameStore
})

function newCharacter() {
  useGameStore.getState().backToMenu()
  useGameStore.getState().startCreate()
  useGameStore.getState().createCharacter({
    name: '服丹',
    gender: 'female',
    aptitude: 'mixed',
    origin: 'wild',
  })
}

describe('坊市买卖不受境界限制（境界只约束使用）', () => {
  it('练气期可直接买下金丹期法宝、渡劫令与高阶功法秘籍（买卖无闸门）', () => {
    newCharacter()
    useGameStore.setState({ stones: 100_000_000 })
    const bought: string[] = []
    for (const id of ['treasure_lotus', 'mat_tribulation', 'scroll_gf_dayan']) {
      const before = useGameStore.getState()
      useGameStore.getState().buyItem(id)
      const after = useGameStore.getState()
      expect(after.inventory[id] ?? 0, `购入 ${id} 应入背包`).toBe((before.inventory[id] ?? 0) + 1)
      if (after.inventory[id]) bought.push(id)
    }
    expect(bought).toEqual(['treasure_lotus', 'mat_tribulation', 'scroll_gf_dayan'])
    // 法宝购入即认主
    expect(useGameStore.getState().treasures).toContain('treasure_lotus')
  })

  it('买得下不等于用得了：境界不足时服用丹药仍被拦（使用门槛保留）', () => {
    newCharacter()
    useGameStore.setState((s) => ({
      stones: 100_000_000,
      inventory: { ...s.inventory, pill_join: 1 }, // 合体丹（minRealm 炼虚）
    }))
    const before = useGameStore.getState().player!.exp
    useGameStore.getState().useItem('pill_join')
    expect(useGameStore.getState().player!.exp).toBe(before)
    expect(useGameStore.getState().inventory.pill_join).toBe(1)
  })

  it('买下的高阶秘籍境界不足时无法参悟，但会留在背包（可等境界到了再参悟）', () => {
    newCharacter()
    useGameStore.setState({ stones: 100_000_000 })
    const scrollId = 'scroll_gf_dayan'
    useGameStore.getState().buyItem(scrollId)
    expect(useGameStore.getState().inventory[scrollId]).toBe(1)
    useGameStore.getState().comprehendGongfa(scrollId)
    // 参悟被境界/品阶门槛拦下：秘籍仍在背包，功法未入门
    expect(useGameStore.getState().inventory[scrollId]).toBe(1)
    expect(useGameStore.getState().gongfa.learned['gf_dayan']).toBeUndefined()
  })
})

describe('丹药服用口径（SPRINT B R-03 / R-10）', () => {
  it('修为丹按数据口径给修为（不再是 pill_qi 专用公式）', () => {
    newCharacter()
    const before = useGameStore.getState().player!.exp
    useGameStore.setState((s) => ({ inventory: { ...s.inventory, pill_qi: 1 } }))
    useGameStore.getState().useItem('pill_qi')
    expect(useGameStore.getState().player!.exp - before).toBe(80)
  })

  it('三纹丹按丹纹倍率结算（80 × 1.45）', () => {
    newCharacter()
    const before = useGameStore.getState().player!.exp
    useGameStore.setState((s) => ({ inventory: { ...s.inventory, pill_qi_w3: 1 } }))
    useGameStore.getState().useItem('pill_qi_w3')
    expect(useGameStore.getState().player!.exp - before).toBe(Math.floor(80 * 1.45))
  })

  it('超出适用范围后药效大减（元婴期服一品丹 → 25%）', () => {
    newCharacter()
    useGameStore.setState((s) => ({
      player: { ...s.player!, realm: 'nascent_soul', layer: 1 },
      inventory: { ...s.inventory, pill_qi: 1 },
    }))
    const before = useGameStore.getState().player!.exp
    useGameStore.getState().useItem('pill_qi')
    expect(useGameStore.getState().player!.exp - before).toBe(20)
  })

  it('渡劫期服「飞升仙露」仍有修为收益（仙缘同时记入）', () => {
    newCharacter()
    useGameStore.setState((s) => ({
      player: { ...s.player!, realm: 'tribulation', layer: 1 },
      inventory: { ...s.inventory, pill_xian: 1 },
      favor: 0,
    }))
    const before = useGameStore.getState().player!.exp
    useGameStore.getState().useItem('pill_xian')
    // 九品五纹：数据 exp 1,200,000 × 丹纹倍率 1.75
    expect(useGameStore.getState().player!.exp - before).toBe(Math.floor(1200000 * 1.75))
    expect(useGameStore.getState().favor).toBe(200)
  })

  it('飞升之后修为无处可去：不再虚增修为，仙缘照给（终局奖励不再是空转）', () => {
    newCharacter()
    useGameStore.setState((s) => ({
      player: { ...s.player!, realm: 'ascended', layer: 1, ascended: true },
      inventory: { ...s.inventory, pill_xian: 1 },
      favor: 0,
    }))
    const before = useGameStore.getState().player!.exp
    useGameStore.getState().useItem('pill_xian')
    expect(useGameStore.getState().player!.exp).toBe(before)
    expect(useGameStore.getState().favor).toBe(200)
  })
})
