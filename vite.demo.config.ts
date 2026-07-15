import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'

const distSdk = resolve(__dirname, 'dist/pay-sdk.js')

export default defineConfig({
  root: resolve(__dirname, 'demo'),
  publicDir: false,
  server: {
    port: 5173,
    open: '/index.html',
    fs: {
      allow: [resolve(__dirname)]
    }
  },
  plugins: [
    {
      name: 'serve-pay-sdk-bundle',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/pay-sdk.js' || req.url?.startsWith('/pay-sdk.js?')) {
            if (!existsSync(distSdk)) {
              res.statusCode = 404
              res.end('dist/pay-sdk.js not found. Run: npm run build')
              return
            }
            res.setHeader('Content-Type', 'application/javascript')
            res.end(readFileSync(distSdk))
            return
          }
          next()
        })
      }
    }
  ]
})
