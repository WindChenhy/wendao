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
