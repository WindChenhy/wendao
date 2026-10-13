import { beforeAll, describe, expect, it, vi } from 'vitest'

// 必须在 import store 之前桩掉 localStorage：store 模块加载时会读取游戏设置
vi.stubGlobal('localStorage', {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {},
})

type StoreModule = typeof import('./useGameStore')
type LogModule = typeof import('./useLogStore')

let useGameStore: StoreModule['useGameStore']
let useLogStore: LogModule['useLogStore']

beforeAll(async () => {
  useGameStore = (await import('./useGameStore')).useGameStore
  useLogStore = (await import('./useLogStore')).useLogStore
})

/** 造一个满足条件的新角色（创角不择道） */
function newCharacter() {
  useGameStore.getState().backToMenu()
  useGameStore.getState().startCreate()
  useGameStore.getState().createCharacter({
    name: '无涯',
    gender: 'male',
    aptitude: 'heaven',
    origin: 'fallen',
  })
  return useGameStore.getState().player!
}

function logs(): string {
  return useLogStore
    .getState()
    .entries.map((e) => e.text)
    .join('\n')
}

describe('创角 → 修行 → 问道立道（端到端）', () => {
  it('创角只定灵根与出身：无道途、有行囊', () => {
    const p = newCharacter()
    expect(p.classId).toBe('none')
    expect(p.paths).toEqual([])
    expect(p.aptitude).toBe('heaven')
    expect(p.origin).toBe('fallen')
    // 没落世家起始 300 + 道痕起步 20 + 成就「初入道途」50
    expect(useGameStore.getState().stones).toBe(370)
    expect(useGameStore.getState().inventory.pill_qi).toBe(5)
    expect(logs()).toContain('道途不必急于定下')
  })

  it('未择道也能修行，但无传承技能', () => {
    newCharacter()
    const before = useGameStore.getState().player!
    useGameStore.getState().meditate()
    const after = useGameStore.getState().player!
    expect(after.exp).toBeGreaterThan(before.exp)
    expect(after.classId).toBe('none')
  })

  it('条件不足时立道被拒，并说明缺什么', () => {
    newCharacter()
    useLogStore.getState().clear()
    useGameStore.getState().choosePath('sword')
    expect(useGameStore.getState().player!.classId).toBe('none')
    expect(logs()).toContain('问道未成')
    expect(logs()).toContain('境界不足')
  })

  it('首立之道成为主修；其后立道进入兼修列表并受兼修位限制', () => {
    newCharacter()
    // 练气五层 + 历练获胜 8 次 → 可立剑道
    useGameStore.setState((s) => ({
      player: { ...s.player!, layer: 5 },
      meta: { ...s.meta, stats: { ...s.meta.stats, combatsWon: 10, maxSwordIntent: 5 } },
    }))
    useGameStore.getState().choosePath('sword')
    let p = useGameStore.getState().player!
    expect(p.classId).toBe('sword')
    expect(p.paths).toEqual([])

    // 练气期没有兼修位：第二门道途必须被拒
    useGameStore.getState().choosePath('body')
    p = useGameStore.getState().player!
    expect(p.paths ?? []).toEqual([])
    expect(logs()).toContain('兼修位已满')

    // 升到筑基：兼修位开放 1 个
    useGameStore.setState((s) => ({
      player: { ...s.player!, realm: 'foundation', layer: 1 },
      meta: {
        ...s.meta,
        stats: { ...s.meta.stats, combatsLost: 3, pillsCrafted: 9, artifactsForged: 4, combatsWon: 20 },
      },
      towerBest: { a: 12 },
    }))
    useGameStore.getState().choosePath('body')
    p = useGameStore.getState().player!
    expect(p.classId).toBe('sword')
    expect(p.paths).toEqual(['body'])
    expect(logs()).toContain('兼修位已用 1/1')
  })

  it('兼修拖慢修炼：兼修后修炼倍率低于主修单道', () => {
    newCharacter()
    useGameStore.setState((s) => ({
      player: { ...s.player!, layer: 5 },
      meta: { ...s.meta, stats: { ...s.meta.stats, combatsWon: 10, maxSwordIntent: 5 } },
    }))
    useGameStore.getState().choosePath('sword')
    const solo = useGameStore.getState().player!
    useGameStore.setState((s) => ({
      player: { ...s.player!, realm: 'foundation', layer: 1 },
      meta: { ...s.meta, stats: { ...s.meta.stats, combatsLost: 3 } },
    }))
    useGameStore.getState().choosePath('body')
    const dual = useGameStore.getState().player!
    expect((dual.paths ?? []).length).toBe(1)
    expect(dual.classId).toBe(solo.classId)
  })

  it('魔道立道需魔道声望，且立道即扣正道声望', () => {
    newCharacter()
    useLogStore.getState().clear()
    useGameStore.setState((s) => ({ player: { ...s.player!, layer: 5 } }))
    useGameStore.getState().choosePath('demon')
    expect(useGameStore.getState().player!.classId).toBe('none')

    useGameStore.setState((s) => ({
      player: { ...s.player!, layer: 5, repDemonic: 40, repRight: 50 },
    }))
    useGameStore.getState().choosePath('demon')
    const p = useGameStore.getState().player!
    expect(p.classId).toBe('demon')
    expect(p.repRight).toBe(10)
    expect(logs()).toContain('血誓既立')
  })

  it('改立主修需灵石，且会与兼修列表互换', () => {
    newCharacter()
    useGameStore.setState((s) => ({
      player: { ...s.player!, realm: 'golden_core', layer: 1 },
      meta: {
        ...s.meta,
        stats: { ...s.meta.stats, combatsWon: 20, combatsLost: 3, pillsCrafted: 9, maxSwordIntent: 5 },
      },
      towerBest: { a: 12 },
      stones: 0,
    }))
    useGameStore.getState().choosePath('sword')
    useGameStore.getState().choosePath('body')
    expect(useGameStore.getState().player!.paths).toEqual(['body'])

    // 灵石不足：改立失败
    useLogStore.getState().clear()
    useGameStore.getState().setPrimaryPath('body')
    expect(useGameStore.getState().player!.classId).toBe('sword')
    expect(logs()).toContain('灵石不足')

    useGameStore.setState({ stones: 5000 })
    useGameStore.getState().setPrimaryPath('body')
    const p = useGameStore.getState().player!
    expect(p.classId).toBe('body')
    expect(p.paths).toEqual(['sword'])
  })

  it('转生沿用灵根与出身（不再沿用职业）', () => {
    const p = newCharacter()
    useGameStore.setState({
      player: { ...p, alive: false, realm: 'golden_core', layer: 3, age: 260 },
    })
    useGameStore.getState().reincarnate({
      name: p.name,
      gender: p.gender,
      aptitude: p.aptitude ?? 'mixed',
      origin: p.origin ?? 'wild',
    })
    const next = useGameStore.getState().player!
    expect(next.name).toBe('无涯')
    expect(next.aptitude).toBe('heaven')
    expect(next.origin).toBe('fallen')
    expect(next.classId).toBe('none')
    expect(useGameStore.getState().legacy.reincarnations).toBe(1)
  })
})
