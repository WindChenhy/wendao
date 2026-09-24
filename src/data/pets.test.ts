import { describe, expect, it } from 'vitest'
import { petAttrBonus, petAssistChance, petExpNeed, PET_ATTR_CAP, type PetState } from './pets'

const pet: PetState = {
  petId: 'pet_rabbit',
  name: '小云',
  level: 10,
  exp: 0,
  bond: 50,
  job: 'farm',
  jobOn: '',
  restUntilDay: 0,
  captureFails: 0,
}

describe('灵兽锚点', () => {
  it('属性加成封顶且突破略抬升', () => {
    expect(petAttrBonus(pet)).toBeLessThanOrEqual(PET_ATTR_CAP)
    expect(petAttrBonus({ ...pet, level: 20 })).toBeCloseTo(Math.min(PET_ATTR_CAP, 20 * 0.004 * 1.15))
  })
  it('亲密度只影响触发率不上限', () => {
    expect(petAssistChance(pet)).toBeGreaterThan(0.55)
    expect(petAssistChance({ ...pet, bond: 100 })).toBeLessThanOrEqual(0.75)
  })
  it('经验曲线', () => {
    expect(petExpNeed(2)).toBeGreaterThan(petExpNeed(1))
  })
})
