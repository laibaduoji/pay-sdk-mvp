import type { PaySdkConfig } from './types.js'
import { normalizeAppleResult, toError } from './normalize.js'

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

function buildPaymentRequest(config: PaySdkConfig): ApplePayJS.ApplePayPaymentRequest {
  const payment = config.payment
  const ap = config.applePay

  const request: ApplePayJS.ApplePayPaymentRequest = {
    countryCode: payment.countryCode,
    currencyCode: payment.currency,
    merchantCapabilities: ap?.merchantCapabilities || DEFAULT_CAPABILITIES,
    supportedNetworks: ap?.supportedNetworks || DEFAULT_NETWORKS,
    total: {
      label: 'ALCHEMY GPS EUROPE UAB',
      type: 'final',
      amount: String(payment.amount)
    }
  }

  if (config.billingAddressRequired) {
    request.requiredBillingContactFields = BILLING_CONTACT_FIELDS
  }

  return request
}

async function fetchMerchantSession(config: PaySdkConfig, validationURL: string): Promise<unknown> {
  const ap = config.applePay!
  const res = await fetch(ap.validateMerchantUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ validationURL })
  })

  if (!res.ok) {
    throw new Error(`Merchant validation failed with status ${res.status}`)
  }
  return res.json()
}

export function payWithApple(config: PaySdkConfig): void {
  const ap = config.applePay

  if (!ap?.validateMerchantUrl) {
    config.onError?.(new Error('applePay.validateMerchantUrl is required'))
    return
  }

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
    // Merchant should verify/process event.payment.token on their backend.
    session.completePayment(ApplePaySession.STATUS_SUCCESS)
    config.onSuccess?.(normalizeAppleResult(event.payment))
  }

  session.oncancel = () => {
    config.onCancel?.()
  }

  session.begin()
}
