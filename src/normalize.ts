import type {
  GooglePayResult,
  ApplePayResult,
  BillingAddress,
  PayRequest,
  PayCustomParam,
  PayBusinessParams,
  PayRiskPayload
} from './types.js'

export function normalizeGoogleResult(
  paymentData: google.payments.api.PaymentData
): GooglePayResult {
  const tokenizationData = paymentData?.paymentMethodData?.tokenizationData
  return {
    method: 'googlePay',
    token: tokenizationData?.token,
    paymentMethodData: paymentData?.paymentMethodData,
    billingAddress: paymentData?.paymentMethodData?.info?.billingAddress,
    email: paymentData?.email,
    raw: paymentData
  }
}

export function normalizeAppleResult(payment: ApplePayJS.ApplePayPayment): ApplePayResult {
  return {
    method: 'applePay',
    token: payment?.token,
    billingContact: payment?.billingContact,
    shippingContact: payment?.shippingContact,
    raw: payment
  }
}

function splitName(name?: string): { firstName: string; lastName: string } {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean)
  return {
    firstName: parts.shift() || '',
    lastName: parts.join(' ')
  }
}

export function normalizeGoogleBillingAddress(
  address?: google.payments.api.Address,
  email?: string
): BillingAddress | undefined {
  if (!address) return undefined
  const name = splitName(address.name)
  return {
    addressLine1: address.address1 || '',
    addressLine2: [address.address2, address.address3].filter(Boolean).join(' '),
    city: address.locality || '',
    state: address.administrativeArea || '',
    zip: address.postalCode || '',
    country: address.countryCode || '',
    firstName: name.firstName,
    lastName: name.lastName,
    phone: address.phoneNumber,
    email
  }
}

export function normalizeAppleBillingAddress(
  contact?: ApplePayJS.ApplePayPaymentContact
): BillingAddress | undefined {
  if (!contact) return undefined
  const lines = contact.addressLines || []
  return {
    addressLine1: lines[0] || '',
    addressLine2: lines.slice(1).join(' '),
    city: contact.locality || '',
    state: contact.administrativeArea || '',
    zip: contact.postalCode || '',
    country: contact.countryCode || '',
    firstName: contact.givenName || '',
    lastName: contact.familyName || '',
    phone: contact.phoneNumber || undefined,
    email: contact.emailAddress || undefined
  }
}

export function normalizeAppleToken(
  token: ApplePayJS.ApplePayPaymentToken
): Record<string, unknown> {
  return {
    paymentData: token.paymentData,
    paymentMethod: token.paymentMethod,
    transactionIdentifier: token.transactionIdentifier
  }
}

/**
 * 组装 alchemy-pay 请求体（对齐 ramp-vue getGP/APAlchemyPayParams）。
 * SDK 侧仍用 BillingAddress / PayRiskPayload 采集，再映射到 wire。
 */
export function buildAlchemyPayRequest(input: {
  orderNo: string
  encryptedData: string
  billingAddress?: BillingAddress
  risk?: PayRiskPayload
}): PayRequest {
  const customParam: PayCustomParam = { encryptedData: input.encryptedData }
  const billing = input.billingAddress
  if (billing) {
    customParam.addressLine1 = billing.addressLine1
    customParam.addressLine2 = billing.addressLine2
    customParam.city = billing.city
    customParam.state = billing.state
    customParam.zip = billing.zip
    customParam.country = billing.country
    customParam.firstName = billing.firstName
    customParam.lastName = billing.lastName
  }

  const businessParams: PayBusinessParams = {}
  const risk = input.risk
  if (risk?.forter?.token) businessParams.cookie = risk.forter.token
  if (risk?.checkout?.deviceSessionId) businessParams.checkoutCookie = risk.checkout.deviceSessionId

  const request: PayRequest = {
    orderNo: input.orderNo,
    customParam
  }
  if (Object.keys(businessParams).length > 0) {
    request.businessParams = businessParams
  }
  if (risk?.worldPay?.sessionId) {
    request.sessionId = risk.worldPay.sessionId
  }
  if (billing) {
    request.poaParams = {
      address: billing.addressLine1,
      city: billing.city,
      state: billing.state,
      postcode: billing.zip,
      country: billing.country
    }
  }
  return request
}

export function isGoogleCancel(err: unknown): boolean {
  // statusCode CANCELED means the user dismissed the sheet.
  return (err as google.payments.api.PaymentsError)?.statusCode === 'CANCELED'
}

export function toError(err: unknown): Error {
  if (err instanceof Error) return err
  if (typeof err === 'string') return new Error(err)
  try {
    return new Error(JSON.stringify(err))
  } catch {
    return new Error('Unknown error')
  }
}
