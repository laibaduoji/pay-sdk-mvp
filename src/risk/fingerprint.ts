import FingerprintJS from '@fingerprintjs/fingerprintjs-pro'
import type { RiskFingerprintConfig } from '../types.js'
import { mergeFingerprintConfig } from './defaults.js'

/** 同页生命周期内复用，避免重复 load / get；并发调用共用一次请求。 */
let cachedVisitorId: string | null = null
let inflight: Promise<string> | null = null

/**
 * FingerprintJS Pro 采集 visitorId（SDK init 用内置默认启动）。
 * https://dashboard.fingerprint.com
 * 结果仅写入请求头 fingerprint-id；失败返回 ""，不阻断支付。
 */
export async function collectFingerprint(cfg?: RiskFingerprintConfig): Promise<string> {
  if (cachedVisitorId) return cachedVisitorId
  if (inflight) return inflight

  inflight = (async () => {
    try {
      const merged = mergeFingerprintConfig(cfg)
      const agent = await FingerprintJS.load({
        apiKey: merged.apiKey,
        scriptUrlPattern: [...merged.scriptUrlPattern, FingerprintJS.defaultScriptUrlPattern],
        endpoint: [...merged.endpoint, FingerprintJS.defaultEndpoint]
      })
      const result = await agent.get()
      const visitorId = result?.visitorId || ''
      if (visitorId) cachedVisitorId = visitorId
      return visitorId
    } catch {
      return ''
    } finally {
      inflight = null
    }
  })()

  return inflight
}
