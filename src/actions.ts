import type { PayResponse, PaymentAction } from './types.js'

let nextActionViewId = 0

/** 从支付响应解析二次动作（不打开任何窗口）。 */
export function describePayResponse(response: PayResponse): PaymentAction | null {
  if (response.MD || response.JWT || response.action) {
    if (!(response.MD && response.JWT && response.action)) {
      throw new Error('Incomplete 3DS action fields (MD, JWT, action are all required)')
    }
    return {
      type: 'threeDS',
      url: response.action,
      MD: response.MD,
      JWT: response.JWT,
      action: response.action
    }
  }
  if (response.webUrl) {
    return {
      type: 'webUrl',
      url: response.webUrl,
      webUrl: response.webUrl
    }
  }
  if (response.threeDSMethodData || response.methodUrl) {
    if (!(response.threeDSMethodData && response.methodUrl)) {
      throw new Error(
        'Incomplete threeDSMethod fields (threeDSMethodData and methodUrl are required)'
      )
    }
    return {
      type: 'threeDSMethod',
      url: response.methodUrl,
      threeDSMethodData: response.threeDSMethodData,
      methodUrl: response.methodUrl
    }
  }
  return null
}

export function describeS3ds(s3dsUrl: string): PaymentAction {
  return {
    type: 's3ds',
    url: s3dsUrl,
    s3dsUrl
  }
}

/**
 * 可选执行器：商户授权后可由 SDK / bridge 打开二次动作。
 * WebView 默认不自动调用，避免强制跳转。
 */
export class PaymentActionView {
  private readonly methodFrameName = `pay-sdk-method-${++nextActionViewId}`
  private readonly challengeFrameName = `pay-sdk-challenge-${nextActionViewId}`
  private challengeOverlay: HTMLDivElement | null = null
  private methodFrame: HTMLIFrameElement | null = null

  open(action: PaymentAction): void {
    if (action.type === 'webUrl' || action.type === 's3ds') {
      window.location.assign(action.url)
      return
    }
    if (action.type === 'threeDS') {
      this.openChallenge(action.action, { MD: action.MD, JWT: action.JWT })
      return
    }
    this.openFormHidden(action.methodUrl, {
      threeDSMethodData: action.threeDSMethodData
    })
  }

  destroy(): void {
    this.challengeOverlay?.remove()
    this.challengeOverlay = null
    this.methodFrame?.remove()
    this.methodFrame = null
  }

  private openChallenge(url: string, fields: Record<string, string>): void {
    this.challengeOverlay?.remove()

    const overlay = document.createElement('div')
    overlay.setAttribute('data-pay-sdk-challenge', '')
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483647',
      background: 'rgba(0, 0, 0, 0.55)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      boxSizing: 'border-box'
    })

    const iframe = document.createElement('iframe')
    iframe.name = this.challengeFrameName
    iframe.title = '3D Secure verification'
    Object.assign(iframe.style, {
      width: 'min(100%, 390px)',
      height: 'min(100%, 400px)',
      border: '0',
      background: '#fff'
    })
    overlay.appendChild(iframe)
    document.body.appendChild(overlay)
    this.challengeOverlay = overlay

    const form = document.createElement('form')
    form.method = 'POST'
    form.action = url
    form.target = this.challengeFrameName
    form.style.display = 'none'
    this.appendFields(form, fields)
    document.body.appendChild(form)
    form.submit()
    form.remove()
  }

  private openFormHidden(url: string, fields: Record<string, string>): void {
    this.methodFrame?.remove()
    const iframe = document.createElement('iframe')
    iframe.name = this.methodFrameName
    iframe.width = '0'
    iframe.height = '0'
    iframe.style.display = 'none'
    iframe.setAttribute('aria-hidden', 'true')
    document.body.appendChild(iframe)
    this.methodFrame = iframe

    const form = document.createElement('form')
    form.method = 'POST'
    form.action = url
    form.target = this.methodFrameName
    form.style.display = 'none'
    this.appendFields(form, fields)
    document.body.appendChild(form)
    form.submit()
    form.remove()
  }

  private appendFields(form: HTMLFormElement, fields: Record<string, string>): void {
    for (const [name, value] of Object.entries(fields)) {
      const input = document.createElement('input')
      input.type = 'hidden'
      input.name = name
      input.value = value
      form.appendChild(input)
    }
  }
}
