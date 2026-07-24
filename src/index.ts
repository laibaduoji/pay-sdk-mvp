import type {
  CreateOrderResponse,
  PayResponse,
  PayResult,
  PaySdkConfig,
  PaySdkInstance,
  PaymentAction,
  PaymentActionMode,
  QueryOrderResponse,
  RuntimeWalletConfig
} from './types.js'
import { ready as detectReady } from './ready.js'
import { renderButton, resolveContainer } from './button.js'
import { applyGooglePayTestDefaults, payWithGoogle } from './googlePay.js'
import { payWithApple } from './applePay.js'
import { PayApiClient, PayApiError } from './api.js'
import { describePayResponse, describeS3ds, PaymentActionView } from './actions.js'
import { resolveEnvironment, resolvePayApiConfig } from './endpoints.js'
import {
  normalizeAppleBillingAddress,
  normalizeAppleToken,
  normalizeGoogleBillingAddress,
  toError
} from './normalize.js'
import { collectRisk } from './risk/index.js'
import { collectFingerprint } from './risk/fingerprint.js'

export type {
  PaySdkConfig,
  ApiPaySdkConfig,
  RuntimeWalletConfig,
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
export { getApiEndpoints, resolvePayApiConfig, resolveEnvironment } from './endpoints.js'
export {
  GOOGLE_PAY_TEST_DEFAULTS,
  GOOGLE_PAY_CALLBACK_INTENTS,
  applyGooglePayTestDefaults
} from './googlePay.js'

function validateConfig(config: PaySdkConfig): void {
  if (!config || typeof config !== 'object') {
    throw new Error('PaySdk.init requires a config object')
  }
  if (!config.container) {
    throw new Error('config.container is required')
  }
  if (
    !config.order ||
    config.order.amount == null ||
    !config.order.currency ||
    !config.order.countryCode
  ) {
    throw new Error('order.amount, order.currency and order.countryCode are required')
  }
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
    if (error.returnCode && error.returnCode !== '0000') return false
    return error.status == null
  }
  return error instanceof TypeError
}

function runtimeConfigFromOrder(
  config: PaySdkConfig,
  order: CreateOrderResponse,
  api: PayApiClient,
  onWalletAuthorized: (result: PayResult) => void | Promise<void>
): RuntimeWalletConfig {
  const environment = resolveEnvironment(config.environment || order.environment)
  const common = {
    container: config.container,
    environment,
    risk: order.risk,
    onSuccess: onWalletAuthorized,
    onError: config.onError,
    onCancel: config.onCancel
  }

  if (order.method === 'googlePay') {
    const params = environment === 'TEST' ? applyGooglePayTestDefaults(order.params) : order.params
    const card = params.allowedPaymentMethods[0]
    if (!card?.tokenizationSpecification) {
      throw new Error('Create order response is missing Google Pay tokenizationSpecification')
    }
    const parameters = card.parameters as google.payments.api.CardParameters
    return {
      ...common,
      method: 'googlePay',
      payment: {
        amount: params.transactionInfo.totalPrice,
        currency: params.transactionInfo.currencyCode,
        countryCode: params.transactionInfo.countryCode || config.order.countryCode
      },
      billingAddressRequired: parameters.billingAddressRequired === true,
      googlePay: {
        merchantId: params.merchantInfo.merchantId,
        merchantName: params.merchantInfo.merchantName,
        allowedAuthMethods: parameters.allowedAuthMethods,
        allowedCardNetworks: parameters.allowedCardNetworks,
        tokenizationSpecification: card.tokenizationSpecification,
        paymentDataRequest: {
          ...params,
          callbackIntents: ['PAYMENT_AUTHORIZATION']
        }
      }
    }
  }

  const validateMerchantUrl = api.getValidateMerchantUrl(order.validateMerchantUrl)
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
      validateMerchantUrl,
      validateMerchant: (validationURL) =>
        api.validateMerchant(validateMerchantUrl, order.orderId, validationURL),
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
  private api: PayApiClient
  private readonly actionView = new PaymentActionView()
  private readonly fingerprintIdPromise: Promise<string>
  private _readyPromise: Promise<true> | null = null
  private _button: HTMLElement | null = null
  private runtimeConfig: RuntimeWalletConfig | null = null
  private order: CreateOrderResponse | null = null
  private pollTimer: number | null = null
  private pollDelayResolve: (() => void) | null = null
  private pollGeneration = 0
  private paymentInFlight = false
  private destroyed = false

  constructor(config: PaySdkConfig) {
    this.config = config
    this.fingerprintIdPromise = collectFingerprint()
    this.api = new PayApiClient(this.buildApiConfig(resolveEnvironment(config.environment)))
  }

  private buildApiConfig(environment: ReturnType<typeof resolveEnvironment>) {
    return resolvePayApiConfig(environment, {
      ...this.config.api,
      getFingerprintId: () => this.fingerprintIdPromise
    })
  }

  ready(): Promise<true> {
    if (!this._readyPromise) {
      this._readyPromise = this.prepare()
    }
    return this._readyPromise
  }

  private async prepare(): Promise<true> {
    if (!this.runtimeConfig) {
      const order = await this.api.createOrder(this.config.order)
      this.order = order
      this.config.onOrderCreated?.(order)

      const environment = resolveEnvironment(this.config.environment || order.environment)
      this.api = new PayApiClient(this.buildApiConfig(environment))

      this.runtimeConfig = runtimeConfigFromOrder(this.config, order, this.api, async (result) => {
        await this.processPayment(result)
      })

      this.runtimeConfig.riskCollection = collectRisk(
        this.runtimeConfig.risk,
        this.runtimeConfig.environment
      )
      void Promise.all([this.fingerprintIdPromise, this.runtimeConfig.riskCollection]).then(
        ([fingerprintId, risk]) => {
          this.config.onRiskCollected?.({
            fingerprintId: fingerprintId || undefined,
            risk
          })
        }
      )
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

  openAction(action: PaymentAction): void {
    this.actionView.open(action)
  }

  private getActionMode(): PaymentActionMode {
    return this.config.actionMode || 'callback'
  }

  private async dispatchAction(
    action: PaymentAction
  ): Promise<'navigated' | 'opened' | 'deferred'> {
    this.config.onAction?.(action)
    if (this.getActionMode() !== 'auto') return 'deferred'

    const handled = this.config.openAction ? await this.config.openAction(action) : false
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
    if (!this.order) {
      throw new Error('Order is not ready')
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
    const apiConfig = this.config.api
    const interval = apiConfig?.pollIntervalMs || 2_000
    const timeoutMs = apiConfig?.pollTimeoutMs ?? 300_000
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
        const current = await this.api.queryOrder(this.order.orderId)
        if (this.destroyed || generation !== this.pollGeneration) return
        consecutiveTransientErrors = 0
        this.config.onStatusChange?.(current)

        if (current.s3dsUrl && current.s3dsUrl !== lastS3dsUrl) {
          lastS3dsUrl = current.s3dsUrl
          const outcome = await this.dispatchAction(describeS3ds(current.s3dsUrl))
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
        this.fail(toError(error))
        return
      }
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.pollDelayResolve = () => resolve()
      this.pollTimer = window.setTimeout(() => {
        this.pollDelayResolve = null
        this.pollTimer = null
        resolve()
      }, ms)
    })
  }

  private stopPolling(): void {
    this.pollGeneration += 1
    if (this.pollTimer != null) {
      window.clearTimeout(this.pollTimer)
      this.pollTimer = null
    }
    const resume = this.pollDelayResolve
    this.pollDelayResolve = null
    resume?.()
  }

  private finish(
    walletResult: PayResult,
    paymentResponse: PayResponse,
    order?: QueryOrderResponse
  ): void {
    this.stopPolling()
    this.actionView.destroy()
    this.paymentInFlight = false
    const result = {
      ...walletResult,
      orderId: this.order?.orderId,
      paymentResponse,
      order
    }
    void this.config.onSuccess?.(result)
    this.config.onComplete?.(result)
  }

  private complete(
    walletResult: PayResult,
    paymentResponse: PayResponse,
    order: QueryOrderResponse
  ): void {
    this.stopPolling()
    this.actionView.destroy()
    this.paymentInFlight = false
    this.config.onComplete?.({
      ...walletResult,
      orderId: this.order?.orderId,
      paymentResponse,
      order
    })
  }

  private fail(error: Error): void {
    this.stopPolling()
    this.actionView.destroy()
    this.paymentInFlight = false
    this.config.onError?.(error)
  }

  destroy(): void {
    this.destroyed = true
    this.stopPolling()
    this.actionView.destroy()
    this.paymentInFlight = false
    this._button?.remove()
    this._button = null
    if (this.runtimeConfig) {
      resolveContainer(this.runtimeConfig.container).replaceChildren()
    }
  }
}

export function init(config: PaySdkConfig): PaySdkInstance {
  validateConfig(config)
  return new PaySdk(config)
}

declare global {
  interface Window {
    PaySdk: { init: typeof init }
  }
}

if (typeof window !== 'undefined') {
  window.PaySdk = { init }
}
