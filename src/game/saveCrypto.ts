/**
 * 存档加密（参照桃源乡模式）：
 * CryptoJS AES + 应用内固定密钥；localStorage 与导出文件均存密文。
 * 不要求玩家设密码，导入时用同一密钥解密校验。
 * v1.3 新格式附带明文 SHA-256 完整性校验段（防手改密文后乱码读档）；
 * 密钥仍在前端 bundle 内，单机语境下属混淆而非防篡改。
 * 按需引入 crypto-js 子模块（AES/SHA256/enc），避免全量打包。
 */
import AES from 'crypto-js/aes'
import Sha256 from 'crypto-js/sha256'
import Hex from 'crypto-js/enc-hex'
import Utf8 from 'crypto-js/enc-utf8'

/** 应用固定密钥（仅本地单机混淆，非服务端鉴权） */
const APP_SECRET = 'wendao-2024-taoyuan-secret'
const ENVELOPE_PREFIX = 'wendao-save-aes:'
/** v1.3 带完整性校验的信封前缀 */
const ENVELOPE_PREFIX_V2 = 'wendao-save-aes2:'
const SEPARATOR = '::'

/** 明文 SHA-256（hex） */
function sha256Hex(text: string): string {
  return Sha256(text).toString(Hex)
}

/** 将明文 JSON 加密为可存储字符串（v2：密文 + 完整性校验段） */
export function encryptSave(plainJson: string): string {
  const cipher = AES.encrypt(plainJson, APP_SECRET).toString()
  return ENVELOPE_PREFIX_V2 + cipher + SEPARATOR + sha256Hex(plainJson)
}

/** 解密；失败或 v2 完整性校验不通过返回 null。旧格式（无校验段）保持可读。 */
export function decryptSave(cipher: string): string | null {
  try {
    let payload = cipher.trim()
    let expectedHash: string | null = null
    if (payload.startsWith(ENVELOPE_PREFIX_V2)) {
      payload = payload.slice(ENVELOPE_PREFIX_V2.length)
      const idx = payload.lastIndexOf(SEPARATOR)
      if (idx <= 0) return null
      expectedHash = payload.slice(idx + SEPARATOR.length)
      payload = payload.slice(0, idx)
    } else if (payload.startsWith(ENVELOPE_PREFIX)) {
      payload = payload.slice(ENVELOPE_PREFIX.length)
    }
    const bytes = AES.decrypt(payload, APP_SECRET)
    const result = bytes.toString(Utf8)
    if (!result) return null
    if (expectedHash != null && sha256Hex(result) !== expectedHash) return null
    return result
  } catch (e) {
    console.warn(e)
    return null
  }
}

export function isEncryptedSave(text: string): boolean {
  const t = text.trim()
  if (t.startsWith(ENVELOPE_PREFIX_V2) || t.startsWith(ENVELOPE_PREFIX)) return true
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
