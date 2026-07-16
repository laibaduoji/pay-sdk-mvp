import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  root: resolve(__dirname, 'demo'),
  publicDir: false,
  server: {
    port: 5173,
    open: '/index.html',
    fs: {
      allow: [resolve(__dirname)]
    }
  }
})
