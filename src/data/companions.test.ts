import { describe, expect, it } from 'vitest'
import {
  COMPANIONS,
  companionById,
  nextStoryBeat,
  storyBeatApplies,
  type CompanionDef,
  type StoryGateContext,
} from './companions'

const ctx = (over: Partial<StoryGateContext> = {}): StoryGateContext => ({
  realm: 'qi',
  sectId: null,
  sectRank: 'menial',
  flags: [],
  ...over,
})

const linWan = companionById('lin_wan')!
const xueMei = companionById('xue_mei')!

describe('道侣长线剧情门槛（SPRINT B R-01）', () => {
  it('非本宗玩家：照常推进原段落，index 正确', () => {
    const r = nextStoryBeat(linWan, 1, ctx())
    expect(r.beat?.id).toBe('lin_wan_p2')
    expect(r.index).toBe(1)
    expect(r.skipped).toEqual([])
  })

  it('青云高位（长老及以上）：改用替代段，HE/BE 结局都不丢', () => {
    const r = nextStoryBeat(linWan, 1, ctx({ sectId: 'qingyun', sectRank: 'elder' }))
    expect(r.beat?.id).toBe('lin_wan_p2_alt')
    expect(r.index).toBe(1)
    expect(r.beat?.choices?.some((c) => c.ending === 'he')).toBe(true)
    expect(r.beat?.choices?.some((c) => c.ending === 'be')).toBe(true)
  })

  it('青云低位（外门弟子，职位低于长老）：仍是原段落', () => {
    const r = nextStoryBeat(linWan, 1, ctx({ sectId: 'qingyun', sectRank: 'outer' }))
    expect(r.beat?.id).toBe('lin_wan_p2')
  })

  it('血煞魔宫高位：改用替代段（不再被自家清算使追责「圣女私嫁外人」）', () => {
    const r = nextStoryBeat(xueMei, 1, ctx({ sectId: 'xuesha', sectRank: 'master' }))
    expect(r.beat?.id).toBe('xue_mei_p2_alt')
    expect(r.beat?.text).not.toContain('外人')
  })

  it('他宗高位不受影响', () => {
    expect(nextStoryBeat(xueMei, 1, ctx({ sectId: 'qingyun', sectRank: 'master' })).beat?.id).toBe(
      'xue_mei_p2',
    )
  })

  it('storyBeatApplies：境界 / flag / 身份 三类门槛', () => {
    expect(storyBeatApplies({ id: 'x', title: '', text: '' }, undefined)).toBe(true)
    expect(
      storyBeatApplies({ id: 'x', title: '', text: '', gates: { minRealm: 'golden_core' } }, ctx()),
    ).toBe(false)
    expect(
      storyBeatApplies(
        { id: 'x', title: '', text: '', gates: { minRealm: 'golden_core' } },
        ctx({ realm: 'nascent_soul' }),
      ),
    ).toBe(true)
    expect(
      storyBeatApplies({ id: 'x', title: '', text: '', gates: { flags: ['sworn'] } }, ctx()),
    ).toBe(false)
    expect(
      storyBeatApplies({ id: 'x', title: '', text: '', gates: { flags: ['sworn'] } }, ctx({ flags: ['sworn'] })),
    ).toBe(true)
    expect(
      storyBeatApplies({ id: 'x', title: '', text: '', gates: { notFlags: ['dead'] } }, ctx({ flags: ['dead'] })),
    ).toBe(false)
  })

  it('无替代段的门槛段：略过、收集交代文案、index 指向真正命中的段（不会死循环）', () => {
    const synthetic = {
      ...linWan,
      postStory: [
        {
          id: 'p0',
          title: 'P0',
          text: 'p0',
          gates: { minRealm: 'mahayana' as const, skipText: '机缘未至，此段暂且搁下。' },
        },
        { id: 'p1', title: 'P1', text: 'p1' },
      ],
    } as CompanionDef
    const r = nextStoryBeat(synthetic, 0, ctx())
    expect(r.beat?.id).toBe('p1')
    expect(r.index).toBe(1)
    expect(r.skipped).toEqual(['机缘未至，此段暂且搁下。'])
  })

  it('剩余段落全被略过：返回 null 且 index 推到结尾（调用方据此推进 postStage）', () => {
    const synthetic = {
      ...linWan,
      postStory: [
        { id: 'x0', title: 'X0', text: 'x0', gates: { minRealm: 'mahayana' as const, skipText: '略过。' } },
        { id: 'x1', title: 'X1', text: 'x1', gates: { minRealm: 'mahayana' as const } },
      ],
    } as CompanionDef
    const r = nextStoryBeat(synthetic, 0, ctx())
    expect(r.beat).toBeNull()
    expect(r.index).toBe(2)
    expect(r.skipped).toEqual(['略过。'])
  })

  it('已推进到结尾时不重复触发', () => {
    const r = nextStoryBeat(linWan, 99, ctx())
    expect(r.beat).toBeNull()
    expect(r.index).toBe(linWan.postStory?.length ?? 0)
  })

  it('数据守卫：有门槛的段落必须给替代段或交代文案，且 id 唯一', () => {
    const seen = new Set<string>()
    for (const c of COMPANIONS) {
      for (const b of c.postStory ?? []) {
        expect(seen.has(b.id), `剧情段 id 重复：${b.id}`).toBe(false)
        seen.add(b.id)
        if (b.gates) {
          expect(
            Boolean(b.gates.alt || b.gates.skipText),
            `${c.id}/${b.id} 设了门槛，却既无替代段也无交代文案（会导致剧情无声消失）`,
          ).toBe(true)
        }
      }
    }
  })
})
