import type {
  ApiPaySdkConfig,
  CreateOrderResponse,
  PayMethod,
  PayResponse,
  PayResult,
  PaySdkConfig,
  PaySdkInstance,
  PaymentAction,
  PaymentActionMode,
  QueryOrderResponse,
  WalletPaySdkConfig
} from './types.js'
import { ready as detectReady } from './ready.js'
import { renderButton, resolveContainer } from './button.js'
import { payWithGoogle } from './googlePay.js'
import { payWithApple } from './applePay.js'
import { PayApiClient, PayApiError } from './api.js'
import { describePayResponse, describeS3ds, PaymentActionView } from './actions.js'
import {
  normalizeAppleBillingAddress,
  normalizeAppleToken,
  normalizeGoogleBillingAddress,
  toError
} from './normalize.js'

export type {
  PaySdkConfig,
  ApiPaySdkConfig,
  WalletPaySdkConfig,
  PaySdkInstance,
  PayMethod,
  Environment,
  PaymentConfig,
  GooglePayButtonConfig,
  GooglePayConfig,
  ApplePayButtonConfig,
  ApplePayConfig,
  PayResult,
  GooglePayResult,
  ApplePayResult,
  CreateOrderRisk,
  PayRiskPayload,
  RiskFingerprintConfig,
  RiskForterConfig,
  RiskCheckoutConfig,
  RiskWorldPayConfig,
  ApiResponse,
  CreateOrderRequest,
  CreateOrderResponse,
  CreateOrderResponseGooglePay,
  CreateOrderResponseApplePay,
  GooglePayParams,
  ApplePayParams,
  BillingAddress,
  PayApiConfig,
  PayRequest,
  PayResponse,
  QueryOrderResponse,
  OrderStatus,
  PaymentAction,
  PaymentActionMode
} from './types.js'

export { PayApiError } from './api.js'
export { describePayResponse, describeS3ds } from './actions.js'

const SUPPORTED_METHODS: PayMethod[] = ['googlePay', 'applePay']

function validateConfig(config: PaySdkConfig): void {
  if (!config || typeof config !== 'object') {
    throw new Error('PaySdk.init requires a config object')
  }
  if (!config.container) {
    throw new Error('config.container is required')
  }
  if (isApiConfig(config)) {
    if (!config.api.createOrderUrl || !config.api.payUrl || !config.api.queryOrderUrl) {
      throw new Error('api.createOrderUrl, api.payUrl and api.queryOrderUrl are required')
    }
    if (
      !config.order ||
      config.order.amount == null ||
      !config.order.currency ||
      !config.order.countryCode
    ) {
      throw new Error('order.amount, order.currency and order.countryCode are required')
    }
    return
  }
  if (!SUPPORTED_METHODS.includes(config.method)) {
    throw new Error(`config.method must be one of: ${SUPPORTED_METHODS.join(', ')}`)
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

function isApiConfig(config: PaySdkConfig): config is ApiPaySdkConfig {
  return 'api' in config && !!config.api
}

function hasSecondaryAction(response: PayResponse): boolean {
  return !!(
    response.webUrl ||
    response.MD ||
    response.JWT ||
    response.action ||
    response.threeDSMethodData ||
    response.methodUrl
  )
}

function isTransientPollError(error: unknown): boolean {
  if (error instanceof PayApiError) {
    if (error.status != null && error.status >= 500) return true
    // 业务 returnCode 失败不重试
    if (error.returnCode && error.returnCode !== '0000') return false
    return error.status == null
  }
  return error instanceof TypeError
}

function withoutPaymentAuthorization(
  intents: google.payments.api.CallbackIntent[] | undefined
): google.payments.api.CallbackIntent[] {
  return (intents || []).filter((intent) => intent !== 'PAYMENT_AUTHORIZATION')
}

function runtimeConfigFromOrder(
  config: ApiPaySdkConfig,
  order: CreateOrderResponse,
  api: PayApiClient,
  onWalletAuthorized: (result: PayResult) => void | Promise<void>
): WalletPaySdkConfig {
  const common = {
    container: config.container,
    environment: order.environment || ('PRODUCTION' as const),
    risk: order.risk,
    onSuccess: onWalletAuthorized,
    onError: config.onError,
    onCancel: config.onCancel
  }

  if (order.method === 'googlePay') {
    const card = order.params.allowedPaymentMethods[0]
    if (!card?.tokenizationSpecification) {
      throw new Error('Create order response is missing Google Pay tokenizationSpecification')
    }
    const parameters = card.parameters as google.payments.api.CardParameters
    return {
      ...common,
      method: 'googlePay',
      payment: {
        amount: order.params.transactionInfo.totalPrice,
        currency: order.params.transactionInfo.currencyCode,
        countryCode: order.params.transactionInfo.countryCode || config.order.countryCode
      },
      billingAddressRequired: parameters.billingAddressRequired === true,
      googlePay: {
        merchantId: order.params.merchantInfo.merchantId,
        merchantName: order.params.merchantInfo.merchantName,
        allowedAuthMethods: parameters.allowedAuthMethods,
        allowedCardNetworks: parameters.allowedCardNetworks,
        tokenizationSpecification: card.tokenizationSpecification,
        paymentDataRequest: {
          ...order.params,
          callbackIntents: withoutPaymentAuthorization(order.params.callbackIntents)
        }
      }
    }
  }

  return {
    ...common,
    method: 'applePay',
    payment: {
      amount: order.params.total.amount,
      currency: order.params.currencyCode,
      countryCode: order.params.countryCode
    },
    billingAddressRequired: (order.params.requiredBillingContactFields?.length || 0) > 0,
    applePay: {
      validateMerchantUrl: order.validateMerchantUrl,
      validateMerchant: (validationURL) =>
        api.validateMerchant(order.validateMerchantUrl, order.orderId, validationURL),
      merchantCapabilities: order.params.merchantCapabilities,
      supportedNetworks: order.params.supportedNetworks,
      totalLabel: order.params.total.label,
      totalType: order.params.total.type,
      paymentRequest: order.params
    }
  }
}

class PaySdk implements PaySdkInstance {
  private readonly config: PaySdkConfig
  private readonly api: PayApiClient | null
  private readonly actionView = new PaymentActionView()
  private _readyPromise: Promise<true> | null = null
  private _button: HTMLElement | null = null
  private runtimeConfig: WalletPaySdkConfig | null = null
  private order: CreateOrderResponse | null = null
  private pollTimer: number | null = null
  private pollDelayResolve: (() => void) | null = null
  private pollGeneration = 0
  private paymentInFlight = false
  private destroyed = false

  constructor(config: PaySdkConfig) {
    this.config = config
    this.api = isApiConfig(config) ? new PayApiClient(config.api) : null
    if (!isApiConfig(config)) this.runtimeConfig = config
  }

  // Resolves once the wallet JS is loaded and the environment supports payment.
  ready(): Promise<true> {
    if (!this._readyPromise) {
      this._readyPromise = this.prepare()
    }
    return this._readyPromise
  }

  private async prepare(): Promise<true> {
    if (!this.runtimeConfig) {
      const config = this.config as ApiPaySdkConfig
      const api = this.api!
      const order = await api.createOrder(config.order)
      this.order = order
      config.onOrderCreated?.(order)
      this.runtimeConfig = runtimeConfigFromOrder(config, order, api, async (result) => {
        await this.processPayment(result)
      })
    }
    return detectReady(this.runtimeConfig)
  }

  private _pay(): void {
    const config = this.runtimeConfig
    if (!config) {
      void this.ready()
        .then(() => this._pay())
        .catch((error) => this.config.onError?.(toError(error)))
      return
    }
    if (config.method === 'googlePay') {
      void payWithGoogle(config)
      return
    }
    payWithApple(config)
  }

  // Renders the official button into the container and wires up the click.
  mount(): this {
    if (this.runtimeConfig) {
      this.render()
    } else {
      void this.ready()
        .then(() => this.render())
        .catch((error) => this.config.onError?.(toError(error)))
    }
    return this
  }

  /** 商户（或 JS Bridge 授权后）可主动让 SDK 打开二次动作。 */
  openAction(action: PaymentAction): void {
    this.actionView.open(action)
  }

  private getActionMode(): PaymentActionMode {
    return isApiConfig(this.config) ? this.config.actionMode || 'callback' : 'callback'
  }

  /** @returns navigated = SDK 已整页跳转；opened = 已开窗/iframe；deferred = 仅回调商户 */
  private async dispatchAction(
    action: PaymentAction
  ): Promise<'navigated' | 'opened' | 'deferred'> {
    this.config.onAction?.(action)
    if (this.getActionMode() !== 'auto') return 'deferred'

    const custom = isApiConfig(this.config) ? this.config.openAction : undefined
    const handled = custom ? await custom(action) : false
    if (handled === true) return 'opened'

    this.actionView.open(action)
    if (action.type === 'webUrl' || action.type === 's3ds') return 'navigated'
    return 'opened'
  }

  private render(): void {
    if (this.destroyed || !this.runtimeConfig) return
    this._button = renderButton(this.runtimeConfig, () => this._pay())
  }

  private async processPayment(walletResult: PayResult): Promise<void> {
    if (!this.api || !this.order || !isApiConfig(this.config)) {
      await this.config.onSuccess?.(walletResult)
      return
    }
    if (this.destroyed) return
    if (this.paymentInFlight) {
      throw new Error('Payment already in progress')
    }

    this.paymentInFlight = true
    try {
      const request = this.buildPayRequest(walletResult)
      const paymentResponse = await this.api.pay(request)
      if (this.destroyed) return

      if (!hasSecondaryAction(paymentResponse)) {
        this.finish(walletResult, paymentResponse)
        return
      }

      const action = describePayResponse(paymentResponse)
      if (this.destroyed) return
      if (action) await this.dispatchAction(action)
      // WebView 友好：不因 webUrl 中断轮询；由商户决定是否跳转/开窗
      void this.pollOrder(walletResult, paymentResponse)
    } catch (error) {
      this.paymentInFlight = false
      this.stopPolling()
      this.actionView.destroy()
      throw error instanceof Error ? error : toError(error)
    }
  }

  private buildPayRequest(walletResult: PayResult) {
    if (!this.order) throw new Error('Order is not ready')

    if (walletResult.method === 'googlePay') {
      if (!walletResult.token) throw new Error('Google Pay token is missing')
      return {
        orderId: this.order.orderId,
        encryptedData: walletResult.token,
        billingAddress: normalizeGoogleBillingAddress(
          walletResult.billingAddress,
          walletResult.email
        ),
        risk: walletResult.risk
      }
    }

    if (!walletResult.token) throw new Error('Apple Pay token is missing')
    return {
      orderId: this.order.orderId,
      encryptedData: normalizeAppleToken(walletResult.token),
      billingAddress: normalizeAppleBillingAddress(walletResult.billingContact),
      risk: walletResult.risk
    }
  }

  private async pollOrder(walletResult: PayResult, paymentResponse: PayResponse): Promise<void> {
    const apiConfig = (this.config as ApiPaySdkConfig).api
    const interval = apiConfig.pollIntervalMs || 2_000
    const timeoutMs = apiConfig.pollTimeoutMs ?? 300_000
    const startedAt = Date.now()
    const generation = ++this.pollGeneration
    let lastS3dsUrl = ''
    let consecutiveTransientErrors = 0
    let firstTick = true

    while (!this.destroyed && this.order && generation === this.pollGeneration) {
      if (!firstTick) await this.delay(interval)
      firstTick = false
      if (this.destroyed || !this.order || generation !== this.pollGeneration) return

      if (Date.now() - startedAt > timeoutMs) {
        this.fail(new Error('Payment status polling timed out'))
        return
      }

      try {
        const current = await this.api!.queryOrder(this.order.orderId)
        if (this.destroyed || generation !== this.pollGeneration) return
        consecutiveTransientErrors = 0
        this.config.onStatusChange?.(current)

        if (current.s3dsUrl && current.s3dsUrl !== lastS3dsUrl) {
          lastS3dsUrl = current.s3dsUrl
          const outcome = await this.dispatchAction(describeS3ds(current.s3dsUrl))
          // 仅 SDK 内置整页跳转时停止；callback / Bridge 开窗继续轮询
          if (outcome === 'navigated') {
            this.stopPolling()
            return
          }
        }

        if (current.status === 'failed') {
          throw new Error(current.failureReason || 'Payment failed')
        }
        if (current.status === 'succeeded') {
          this.finish(walletResult, paymentResponse, current)
          return
        }
        if (current.s3dsComplete === true) {
          this.complete(walletResult, paymentResponse, current)
          return
        }
      } catch (error) {
        if (this.destroyed || generation !== this.pollGeneration) return
        if (isTransientPollError(error)) {
          consecutiveTransientErrors += 1
          if (consecutiveTransientErrors < 5) continue
        }
        this.fail(error)
        return
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.pollDelayResolve = resolve
      this.pollTimer = window.setTimeout(() => {
        this.pollTimer = null
        this.pollDelayResolve = null
        resolve()
      }, ms)
    })
  }

  private finish(
    walletResult: PayResult,
    paymentResponse: PayResponse,
    order?: QueryOrderResponse
  ): void {
    const result = this.complete(walletResult, paymentResponse, order)
    this.config.onSuccess?.(result)
  }

  private complete(
    walletResult: PayResult,
    paymentResponse: PayResponse,
    order?: QueryOrderResponse
  ): PayResult {
    this.paymentInFlight = false
    this.stopPolling()
    this.actionView.destroy()
    const result: PayResult = {
      ...walletResult,
      orderId: this.order?.orderId,
      paymentResponse,
      order
    }
    this.config.onComplete?.(result)
    return result
  }

  private fail(error: unknown): void {
    this.paymentInFlight = false
    this.stopPolling()
    this.actionView.destroy()
    this.config.onError?.(
      error instanceof PayApiError || error instanceof Error ? error : toError(error)
    )
  }

  private stopPolling(): void {
    this.pollGeneration += 1
    if (this.pollTimer !== null) {
      window.clearTimeout(this.pollTimer)
      this.pollTimer = null
    }
    this.pollDelayResolve?.()
    this.pollDelayResolve = null
  }

  destroy(): void {
    this.destroyed = true
    this.paymentInFlight = false
    this.stopPolling()
    this.actionView.destroy()
    this._button?.remove()
    this._button = null
    const el = resolveContainer(this.config.container)
    if (el) el.innerHTML = ''
  }
}

export function init(config: PaySdkConfig): PaySdkInstance {
  validateConfig(config)
  return new PaySdk(config)
}
