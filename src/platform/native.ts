/**
 * 原生壳判定与文件落地。
 * 刻意不 import '@capacitor/core'：Web 版不该为原生能力付出包体，Capacitor 由壳层注入 window.Capacitor。
 */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false
  const injected = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  return typeof injected?.isNativePlatform === 'function' && injected.isNativePlatform()
}

/** Android 壳内 a.download 无人接管（Capacitor 没有 DownloadListener），改写应用目录 + 系统分享面板 */
export async function saveTextFileNative(filename: string, text: string): Promise<void> {
  const { Filesystem, Directory } = await import('@capacitor/filesystem')
  const { Share } = await import('@capacitor/share')
  const written = await Filesystem.writeFile({
    path: filename,
    data: text,
    directory: Directory.Documents,
    recursive: true,
  })
  await Share.share({
    title: '问道存档',
    url: written.uri,
    dialogTitle: '保存存档',
  }).catch((e) => {
    // 用户在分享面板取消属于正常路径：文件已落盘，不应冒泡成「导出失败」
    const msg = e instanceof Error ? e.message : String(e ?? '')
    if (/cancel|取消/i.test(msg)) return
    throw e
  })
}
