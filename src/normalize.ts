import type { GooglePayResult, ApplePayResult, BillingAddress } from './types.js'

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

function onlyCompleteBillingAddress(address: BillingAddress): BillingAddress | undefined {
  const required = [
    address.addressLine1,
    address.city,
    address.state,
    address.zip,
    address.country,
    address.firstName,
    address.lastName
  ]
  return required.every((value) => value.trim().length > 0) ? address : undefined
}

export function normalizeGoogleBillingAddress(
  address?: google.payments.api.Address,
  email?: string
): BillingAddress | undefined {
  if (!address) return undefined
  const name = splitName(address.name)
  return onlyCompleteBillingAddress({
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
  })
}

export function normalizeAppleBillingAddress(
  contact?: ApplePayJS.ApplePayPaymentContact
): BillingAddress | undefined {
  if (!contact) return undefined
  const lines = contact.addressLines || []
  return onlyCompleteBillingAddress({
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
  })
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
