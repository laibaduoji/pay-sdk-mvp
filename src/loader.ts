const GOOGLE_PAY_JS = 'https://pay.google.com/gp/p/js/pay.js'
const APPLE_PAY_JS = 'https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js'

const cache: Record<string, Promise<void> | undefined> = {}

interface LoadOptions {
  crossorigin?: boolean
  id?: string
  integrity?: string
  /** 默认 async；Risk.js 文档使用 defer */
  defer?: boolean
}

export function loadScript(
  src: string,
  { crossorigin = false, id, integrity, defer = false }: LoadOptions = {}
): Promise<void> {
  const cached = cache[src]
  if (cached) return cached

  const promise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      id ? `script#${CSS.escape(id)}` : `script[src="${src}"]`
    )
    if (existing) {
      if (existing.dataset.loaded === 'true') return resolve()
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)))
      return
    }

    const script = document.createElement('script')
    if (id) script.id = id
    script.src = src
    if (defer) {
      script.defer = true
    } else {
      script.async = true
    }
    if (integrity) {
      script.integrity = integrity
      script.crossOrigin = 'anonymous'
    } else if (crossorigin) {
      script.crossOrigin = 'anonymous'
    }
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true'
      resolve()
    })
    script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)))
    document.head.appendChild(script)
  })

  cache[src] = promise
  return promise
}

export function loadGooglePay(): Promise<void> {
  if (window.google?.payments?.api) return Promise.resolve()
  return loadScript(GOOGLE_PAY_JS)
}

export function loadApplePay(): Promise<void> {
  // ApplePaySession may be natively present (Safari) without the button SDK.
  // The official <apple-pay-button> element still requires apple-pay-sdk.js.
  return loadScript(APPLE_PAY_JS, { crossorigin: true }).catch(() => {
    // Non-Apple browsers can't fetch the CDN script; resolve so ready() can
    // still report an accurate (unsupported) environment.
  })
}
