import type { PaySdkConfig, PayMethod } from './types.js'
import { ready as detectReady } from './ready.js'
import { renderButton, resolveContainer } from './button.js'
import { payWithGoogle } from './googlePay.js'
import { payWithApple } from './applePay.js'

export type {
  PaySdkConfig,
  PayMethod,
  PayResult,
  GooglePayResult,
  ApplePayResult
} from './types.js'

const SUPPORTED_METHODS: PayMethod[] = ['googlePay', 'applePay']

function validateConfig(config: PaySdkConfig): void {
  if (!config || typeof config !== 'object') {
    throw new Error('PaySdk.init requires a config object')
  }
  if (!SUPPORTED_METHODS.includes(config.method)) {
    throw new Error(`config.method must be one of: ${SUPPORTED_METHODS.join(', ')}`)
  }
  if (!config.container) {
    throw new Error('config.container is required')
  }
  if (!config.payment || config.payment.amount == null || !config.payment.currency) {
    throw new Error('config.payment.amount and config.payment.currency are required')
  }
  if (config.method === 'googlePay' && !config.googlePay?.tokenizationSpecification) {
    throw new Error('googlePay.tokenizationSpecification is required')
  }
  if (config.method === 'applePay' && !config.applePay?.validateMerchantUrl) {
    throw new Error('applePay.validateMerchantUrl is required')
  }
}

class PaySdkInstance {
  private config: PaySdkConfig
  private _readyPromise: Promise<true> | null = null
  private _button: HTMLElement | null = null

  constructor(config: PaySdkConfig) {
    this.config = config
  }

  // Resolves once the wallet JS is loaded and the environment supports payment.
  ready(): Promise<true> {
    if (!this._readyPromise) {
      this._readyPromise = detectReady(this.config)
    }
    return this._readyPromise
  }

  private _pay(): void {
    if (this.config.method === 'googlePay') {
      void payWithGoogle(this.config)
      return
    }
    payWithApple(this.config)
  }

  // Renders the official button into the container and wires up the click.
  mount(): this {
    this._button = renderButton(this.config, () => this._pay())
    return this
  }

  destroy(): void {
    this._button?.remove()
    this._button = null
    const el = resolveContainer(this.config.container)
    if (el) el.innerHTML = ''
  }
}

export function init(config: PaySdkConfig): PaySdkInstance {
  validateConfig(config)
  return new PaySdkInstance(config)
}
