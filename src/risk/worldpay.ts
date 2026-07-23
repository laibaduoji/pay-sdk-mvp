import type { RiskWorldPayConfig } from '../types.js'
import { mergeWorldPayConfig } from './defaults.js'

const IFRAME_ID = 'pay-sdk-ddc-iframe'
const TIMEOUT_MS = 10_000

/** 同页复用 sessionId；并发共用一次采集。 */
let cachedSessionId: string | null = null
let inflight: Promise<string> | null = null

function removeDdcIframe(): void {
  const existing = document.getElementById(IFRAME_ID)
  if (existing?.parentNode) existing.parentNode.removeChild(existing)
}

/**
 * Cardinal DDC：隐藏 iframe + form POST（Bin/JWT）。
 * 对齐 ramp-vue worldPay.js / worldPaySessionMixin，不依赖外部 html 资源。
 */
function startDeviceDataCollection(bin: string, jwt: string, actionUrl: string): void {
  removeDdcIframe()

  const iframe = document.createElement('iframe')
  iframe.id = IFRAME_ID
  iframe.name = IFRAME_ID
  iframe.height = '1'
  iframe.width = '1'
  iframe.style.display = 'none'
  document.body.appendChild(iframe)

  const form = document.createElement('form')
  form.method = 'POST'
  form.action = actionUrl
  form.target = IFRAME_ID
  form.style.display = 'none'

  const binInput = document.createElement('input')
  binInput.type = 'hidden'
  binInput.name = 'Bin'
  binInput.value = bin
  form.appendChild(binInput)

  const jwtInput = document.createElement('input')
  jwtInput.type = 'hidden'
  jwtInput.name = 'JWT'
  jwtInput.value = jwt
  form.appendChild(jwtInput)

  document.body.appendChild(form)
  form.submit()
  form.remove()
}

function parseSessionId(data: unknown): string {
  try {
    const parsed = typeof data === 'string' ? (JSON.parse(data) as unknown) : data
    if (
      parsed &&
      typeof parsed === 'object' &&
      'Status' in parsed &&
      (parsed as { Status?: unknown }).Status &&
      'SessionId' in parsed
    ) {
      const id = (parsed as { SessionId?: unknown }).SessionId
      return typeof id === 'string' ? id : id != null ? String(id) : ''
    }
  } catch {
    /* ignore */
  }
  return ''
}

/**
 * WorldPay / Cardinal Cruise DDC 采集 sessionId。
 * enabled 由 collectRisk 判断；无 jwt 或失败返回 ""，不阻断支付。
 */
export async function collectWorldPay(cfg?: RiskWorldPayConfig): Promise<string> {
  if (cachedSessionId) return cachedSessionId
  if (inflight) return inflight

  inflight = (async () => {
    const merged = mergeWorldPayConfig(cfg)
    if (!merged.jwt) return ''

    let allowedOrigin: string
    try {
      allowedOrigin = new URL(merged.actionUrl).origin
    } catch {
      return ''
    }

    return await new Promise<string>((resolve) => {
      let settled = false
      const finish = (sessionId: string) => {
        if (settled) return
        settled = true
        window.clearTimeout(timer)
        window.removeEventListener('message', onMessage)
        removeDdcIframe()
        if (sessionId) cachedSessionId = sessionId
        resolve(sessionId)
      }

      const onMessage = (event: MessageEvent) => {
        if (event.origin !== allowedOrigin) return
        const sessionId = parseSessionId(event.data)
        if (sessionId) finish(sessionId)
      }

      const timer = window.setTimeout(() => finish(''), TIMEOUT_MS)

      try {
        window.addEventListener('message', onMessage)
        startDeviceDataCollection(merged.bin, merged.jwt, merged.actionUrl)
      } catch {
        finish('')
      }
    })
  })().finally(() => {
    inflight = null
  })

  return inflight
}
