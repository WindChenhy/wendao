import { describe, expect, it } from 'vitest'
import { petAttrBonus, petAssistChance, petExpNeed, petStatBonus, PET_ATTR_CAP, type PetState } from './pets'

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
  broken: true,
  fight: true,
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
  it('仅出战生效，攻血两路各自封顶', () => {
    expect(petStatBonus({ ...pet, fight: false })).toEqual({ atk: 0, hp: 0 })
    const b = petStatBonus(pet)
    expect(b.atk).toBeLessThanOrEqual(PET_ATTR_CAP)
    expect(b.hp).toBeLessThanOrEqual(PET_ATTR_CAP)
    expect(b.atk).toBeCloseTo(Math.min(PET_ATTR_CAP, petAttrBonus(pet) * 0.6))
  })
  it('未突破时不吃 1.15 系数', () => {
    expect(petAttrBonus({ ...pet, broken: false })).toBeCloseTo(Math.min(PET_ATTR_CAP, 10 * 0.004))
  })
})
