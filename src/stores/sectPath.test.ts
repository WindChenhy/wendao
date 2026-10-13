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

/** 造一个未立道的新角色 */
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

/** 直接安置宗门身份（绕过入门考核，专注测拜师分支） */
function putInSect(sectId: string, rank: string, contribution: number, realm = 'qi', layer = 1) {
  useGameStore.setState((s) => ({
    player: { ...s.player!, realm: realm as never, layer },
    sect: { ...s.sect, sectId, rank: rank as never, contribution },
  }))
}

describe('R-21 藏经阁拜师立道', () => {
  it('贡献不足时拜师被拒', () => {
    newCharacter()
    putInSect('qingyun', 'outer', 100)
    useLogStore.getState().clear()
    useGameStore.getState().sectLearn('path_sword', 300)
    expect(useGameStore.getState().player!.classId).toBe('none')
    expect(logs()).toContain('贡献不足')
  })

  it('外门弟子足额贡献即可拜师立剑道，无需百战自悟履历', () => {
    newCharacter()
    // 练气一层、combatsWon=0：自悟条件不满足，但师承可绕过
    putInSect('qingyun', 'outer', 1000, 'qi', 1)
    useGameStore.setState((s) => ({
      meta: { ...s.meta, stats: { ...s.meta.stats, combatsWon: 0 } },
    }))
    useLogStore.getState().clear()
    useGameStore.getState().sectLearn('path_sword', 300)
    const p = useGameStore.getState().player!
    expect(p.classId).toBe('sword')
    expect(p.paths).toEqual([])
    expect(useGameStore.getState().sect.contribution).toBe(700)
    expect(logs()).toContain('亲传道印')
  })

  it('境界窗口边界：元婴可拜师，化神起被拒（自立门户）', () => {
    newCharacter()
    putInSect('qingyun', 'outer', 1000, 'nascent_soul', 1)
    useGameStore.getState().sectLearn('path_sword', 300)
    expect(useGameStore.getState().player!.classId).toBe('sword')

    newCharacter()
    putInSect('qingyun', 'outer', 1000, 'spirit_sea', 1)
    useLogStore.getState().clear()
    useGameStore.getState().sectLearn('path_sword', 300)
    expect(useGameStore.getState().player!.classId).toBe('none')
    expect(logs()).toContain('自立门户')
  })

  it('重复立道被拦', () => {
    newCharacter()
    putInSect('qingyun', 'outer', 1000)
    useGameStore.getState().sectLearn('path_sword', 300)
    useLogStore.getState().clear()
    useGameStore.getState().sectLearn('path_sword', 300)
    expect(logs()).toContain('已立')
    // 不重复扣费
    expect(useGameStore.getState().sect.contribution).toBe(700)
  })

  it('职位门槛：幽冥魂道需内门，外门被拒', () => {
    newCharacter()
    putInSect('youming', 'outer', 2000, 'golden_core', 1)
    useLogStore.getState().clear()
    useGameStore.getState().sectLearn('path_soul', 800)
    expect(useGameStore.getState().player!.classId).toBe('none')
    expect(logs()).toContain('职位')
  })

  it('境界门槛：魂道传承需金丹，筑基被拒', () => {
    newCharacter()
    putInSect('youming', 'inner', 2000, 'foundation', 1)
    useLogStore.getState().clear()
    useGameStore.getState().sectLearn('path_soul', 800)
    expect(useGameStore.getState().player!.classId).toBe('none')
    expect(logs()).toContain('修为尚浅')
  })

  it('内门金丹可拜师魂道：扣贡献、耗一年寿元', () => {
    newCharacter()
    useGameStore.setState((s) => ({ player: { ...s.player!, lifespanLeft: 300 } }))
    putInSect('youming', 'inner', 2000, 'golden_core', 1)
    useGameStore.getState().sectLearn('path_soul', 800)
    const p = useGameStore.getState().player!
    expect(p.classId).toBe('soul')
    expect(p.lifespanLeft).toBe(299)
    expect(useGameStore.getState().sect.contribution).toBe(1200)
  })

  it('魔道传承照结血誓代价：正道声望 -40、煞气初生', () => {
    newCharacter()
    putInSect('xuesha', 'outer', 2000, 'qi', 5)
    useGameStore.setState((s) => ({ player: { ...s.player!, repRight: 50, repDemonic: 0 } }))
    useGameStore.getState().sectLearn('path_demon', 500)
    const p = useGameStore.getState().player!
    expect(p.classId).toBe('demon')
    expect(p.repRight).toBe(10)
    expect(p.shaqi).toBeGreaterThanOrEqual(10)
    expect(logs()).toContain('血誓既立')
  })

  it('师承立道同样受兼修位约束（练气期第二道被拒）', () => {
    newCharacter()
    putInSect('qingyun', 'outer', 2000)
    useGameStore.getState().sectLearn('path_sword', 300)
    // 练气兼修位为 0：即便另一宗门也无法拜师第二道（此处直接再走本阁之外无第二条，验证位满提示）
    useLogStore.getState().clear()
    useGameStore.getState().choosePath('body')
    expect(useGameStore.getState().player!.paths ?? []).toEqual([])
    expect(logs()).toContain('兼修位已满')
  })
})
