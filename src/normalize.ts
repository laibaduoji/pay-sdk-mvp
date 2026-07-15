import type { GooglePayResult, ApplePayResult } from './types.js'

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
