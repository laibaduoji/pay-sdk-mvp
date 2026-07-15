import { defineConfig } from 'vite'
import { resolve } from 'node:path'

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'PaySdk',
      formats: ['iife'],
      fileName: () => 'pay-sdk.js'
    },
    outDir: 'dist',
    emptyOutDir: true,
    minify: false
  }
})
