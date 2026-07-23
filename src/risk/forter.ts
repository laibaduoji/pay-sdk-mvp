import type { RiskForterConfig } from '../types.js'
import { FORTER_DEFAULTS } from './defaults.js'
import { runForterBootstrap } from './forterInject.js'

const TOKEN_READY = 'ftr:tokenReady'
const COOKIE_NAME = 'forterToken'
const TIMEOUT_MS = 15_000

let injectedSiteId: string | null = null

function readForterTokenCookie(): string {
  try {
    const parts = document.cookie.split(';')
    for (const part of parts) {
      const trimmed = part.trim()
      const prefix = `${COOKIE_NAME}=`
      if (trimmed.startsWith(prefix)) {
        return decodeURIComponent(trimmed.slice(prefix.length)) || ''
      }
    }
  } catch {
    /* ignore */
  }
  return ''
}

function mergeSiteId(cfg?: RiskForterConfig): string {
  return (cfg?.siteId || FORTER_DEFAULTS.siteId).trim()
}

/**
 * Forter 前端 token（完整 evt.detail / forterToken cookie）。
 * https://docs.forter.com/front-end-integration
 * 失败返回 ""，不阻断支付。
 */
export async function collectForter(cfg?: RiskForterConfig): Promise<string> {
  const siteId = mergeSiteId(cfg)
  if (!siteId) return ''

  const cached = readForterTokenCookie()
  if (cached) return cached

  return await new Promise<string>((resolve) => {
    let settled = false
    const finish = (token: string) => {
      if (settled) return
      settled = true
      window.clearTimeout(timer)
      document.removeEventListener(TOKEN_READY, onReady as EventListener)
      resolve(token || '')
    }

    const onReady = (evt: Event) => {
      const detail = (evt as CustomEvent<string>).detail
      finish(typeof detail === 'string' ? detail : '')
    }

    const timer = window.setTimeout(() => {
      finish(readForterTokenCookie())
    }, TIMEOUT_MS)

    document.addEventListener(TOKEN_READY, onReady as EventListener)

    try {
      if (injectedSiteId !== siteId) {
        runForterBootstrap(siteId)
        injectedSiteId = siteId
      } else {
        // 已注入过：再等事件或 cookie
        const again = readForterTokenCookie()
        if (again) finish(again)
      }
    } catch {
      finish('')
    }
  })
}
