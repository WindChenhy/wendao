import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        // 拆分 vendor：react 全家桶与 crypto-js 独立成块，业务代码改动不再打穿缓存
        manualChunks(id: string) {
          if (id.includes('node_modules')) {
            if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor-react'
            if (id.includes('crypto-js')) return 'vendor-crypto'
          }
          return undefined
        },
      },
    },
  },
})
