import { describe, expect, it } from 'vitest'
import { decryptSave, encryptSave, isEncryptedSave } from './saveCrypto'

const PLAIN = JSON.stringify({ name: '云无羁', year: 5, reincarnations: 2 })
const PREFIX_V2 = 'wendao-save-aes2:'
const PREFIX_V1 = 'wendao-save-aes:'
const SEP = '::'

/** 从 v2 信封中剥出裸密文，用于构造旧格式与篡改用例 */
function bareCipherOf(envelope: string): string {
  const payload = envelope.slice(PREFIX_V2.length)
  return payload.slice(0, payload.lastIndexOf(SEP))
}

function swapFirstChar(text: string): string {
  const c = text.charAt(0)
  return (c === 'A' ? 'B' : 'A') + text.slice(1)
}

describe('存档加密', () => {
  it('encryptSave → decryptSave 往返相等', () => {
    const cipher = encryptSave(PLAIN)
    expect(cipher).not.toContain('云无羁')
    expect(decryptSave(cipher)).toBe(PLAIN)
  })

  it('v2 密文以 wendao-save-aes2: 开头且含 :: 校验段', () => {
    const cipher = encryptSave(PLAIN)
    expect(cipher.startsWith(PREFIX_V2)).toBe(true)
    const payload = cipher.slice(PREFIX_V2.length)
    const idx = payload.lastIndexOf(SEP)
    expect(idx).toBeGreaterThan(0)
    expect(payload.slice(idx + SEP.length)).toMatch(/^[0-9a-f]{64}$/)
  })

  it('篡改密文（校验段外）→ decryptSave 返回 null', () => {
    const cipher = encryptSave(PLAIN)
    const cipherBody = bareCipherOf(cipher)
    const tail = cipher.slice(PREFIX_V2.length + cipherBody.length)
    const tampered = PREFIX_V2 + swapFirstChar(cipherBody) + tail
    expect(tampered).not.toBe(cipher)
    expect(decryptSave(tampered)).toBeNull()
  })

  it('篡改校验段同样返回 null', () => {
    const cipher = encryptSave(PLAIN)
    const tampered = cipher.slice(0, -1) + (cipher.endsWith('a') ? 'b' : 'c')
    expect(decryptSave(tampered)).toBeNull()
  })

  it('旧格式（wendao-save-aes: 前缀、无校验段）仍可解密（向后兼容）', () => {
    const legacy = PREFIX_V1 + bareCipherOf(encryptSave(PLAIN))
    expect(legacy.startsWith(PREFIX_V1)).toBe(true)
    expect(decryptSave(legacy)).toBe(PLAIN)
  })

  it('v2 信封缺校验段 → null', () => {
    expect(decryptSave(PREFIX_V2 + bareCipherOf(encryptSave(PLAIN)))).toBeNull()
  })

  it('isEncryptedSave：v2/v1 前缀 true，普通 JSON false，长 base64 true', () => {
    const cipher = encryptSave(PLAIN)
    expect(isEncryptedSave(cipher)).toBe(true)
    expect(isEncryptedSave(PREFIX_V1 + 'U2FsdGVkX1')).toBe(true)
    expect(isEncryptedSave(PLAIN)).toBe(false)
    expect(isEncryptedSave('{"name":"云无羁"}')).toBe(false)
    expect(isEncryptedSave('A'.repeat(64))).toBe(true)
    expect(isEncryptedSave('abc')).toBe(false)
  })

  it('明文 JSON 直接传入 decryptSave 返回 null', () => {
    expect(decryptSave(PLAIN)).toBeNull()
    expect(decryptSave('{"a":1}')).toBeNull()
  })
})
