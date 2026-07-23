import type { ApiResponse, WalletPaySdkConfig } from './types.js'
import { normalizeAppleResult, toError } from './normalize.js'
import { collectRisk } from './risk/index.js'

const APPLE_PAY_VERSION = 3

const DEFAULT_CAPABILITIES: ApplePayJS.ApplePayMerchantCapability[] = [
  'supports3DS',
  'supportsCredit',
  'supportsDebit'
]

const DEFAULT_NETWORKS = ['masterCard', 'visa']

const BILLING_CONTACT_FIELDS: ApplePayJS.ApplePayContactField[] = [
  'name',
  'postalAddress',
  'phone',
  'email'
]

function buildPaymentRequest(config: WalletPaySdkConfig): ApplePayJS.ApplePayPaymentRequest {
  const payment = config.payment
  const ap = config.applePay
  if (ap?.paymentRequest) {
    return ap.paymentRequest as ApplePayJS.ApplePayPaymentRequest
  }

  const request: ApplePayJS.ApplePayPaymentRequest = {
    countryCode: payment.countryCode,
    currencyCode: payment.currency,
    merchantCapabilities: ap?.merchantCapabilities || DEFAULT_CAPABILITIES,
    supportedNetworks: ap?.supportedNetworks || DEFAULT_NETWORKS,
    total: {
      label: ap?.totalLabel || 'ALCHEMY GPS EUROPE UAB',
      type: ap?.totalType || 'final',
      amount: String(payment.amount)
    }
  }

  if (config.billingAddressRequired) {
    request.requiredBillingContactFields = BILLING_CONTACT_FIELDS
  }

  return request
}

async function fetchMerchantSession(
  config: WalletPaySdkConfig,
  validationURL: string
): Promise<Record<string, unknown>> {
  const ap = config.applePay!
  if (ap.validateMerchant) {
    return ap.validateMerchant(validationURL)
  }

  const res = await fetch(ap.validateMerchantUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ validationURL })
  })

  if (!res.ok) {
    throw new Error(`Merchant validation failed with status ${res.status}`)
  }

  const body = (await res.json()) as ApiResponse<Record<string, unknown>> & {
    data?: Record<string, unknown>
  }

  // 统一壳：returnCode === '0000' 时 data 为 merchantSession
  if (typeof body?.returnCode === 'string') {
    if (body.returnCode !== '0000') {
      throw new Error(body.returnMsg || 'Merchant validation failed')
    }
    if (!body.data || typeof body.data !== 'object') {
      throw new Error('Merchant validation response missing data')
    }
    return body.data
  }

  // 兼容旧响应：{ data: merchantSession }（无 returnCode）
  if (body?.data && typeof body.data === 'object') {
    return body.data
  }

  throw new Error('Merchant validation response missing data')
}

export function payWithApple(config: WalletPaySdkConfig): void {
  const ap = config.applePay

  if (!ap?.validateMerchantUrl) {
    config.onError?.(new Error('applePay.validateMerchantUrl is required'))
    return
  }

  const riskPromise = collectRisk(config.risk, config.environment)
  const session = new ApplePaySession(APPLE_PAY_VERSION, buildPaymentRequest(config))

  session.onvalidatemerchant = async (event) => {
    try {
      const merchantSession = await fetchMerchantSession(config, event.validationURL)
      session.completeMerchantValidation(merchantSession)
    } catch (err) {
      session.abort()
      config.onError?.(toError(err))
    }
  }

  session.onpaymentauthorized = (event) => {
    void (async () => {
      try {
        const base = normalizeAppleResult(event.payment)
        const risk = await riskPromise
        await config.onSuccess?.({ ...base, risk })
        session.completePayment(ApplePaySession.STATUS_SUCCESS)
      } catch (err) {
        try {
          session.completePayment(ApplePaySession.STATUS_FAILURE)
        } catch {
          /* session may already be finished */
        }
        config.onError?.(toError(err))
      }
    })()
  }

  session.oncancel = () => {
    config.onCancel?.()
  }

  session.begin()
}
