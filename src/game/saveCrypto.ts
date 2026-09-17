/**
 * 存档加密（参照桃源乡模式）：
 * CryptoJS AES + 应用内固定密钥；localStorage 与导出文件均存密文。
 * 不要求玩家设密码，导入时用同一密钥解密校验。
 */
import CryptoJS from 'crypto-js'

/** 应用固定密钥（仅本地单机混淆，非服务端鉴权） */
const APP_SECRET = 'wendao-2024-taoyuan-secret'
const ENVELOPE_PREFIX = 'wendao-save-aes:'

/** 将明文 JSON 加密为可存储字符串 */
export function encryptSave(plainJson: string): string {
  return ENVELOPE_PREFIX + CryptoJS.AES.encrypt(plainJson, APP_SECRET).toString()
}

/** 解密；失败返回 null */
export function decryptSave(cipher: string): string | null {
  try {
    let payload = cipher.trim()
    if (payload.startsWith(ENVELOPE_PREFIX)) payload = payload.slice(ENVELOPE_PREFIX.length)
    const bytes = CryptoJS.AES.decrypt(payload, APP_SECRET)
    const result = bytes.toString(CryptoJS.enc.Utf8)
    return result || null
  } catch {
    return null
  }
}

export function isEncryptedSave(text: string): boolean {
  const t = text.trim()
  if (t.startsWith(ENVELOPE_PREFIX)) return true
  // CryptoJS 默认输出 base64 密文（可能含 OpenSSL Salted__ 前缀编码）
  return /^[A-Za-z0-9+/=]+$/.test(t) && t.length > 32
}

export function downloadTextFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/octet-stream' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function describeExportError(e: unknown): string {
  const code = e instanceof Error ? e.message : ''
  if (code === 'NO_PLAYER') return '请先进入一局游戏再导出。'
  if (e instanceof Error && e.message) return `导出失败：${e.message}`
  return '导出失败，请重试。'
}
