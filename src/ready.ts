import type { PaySdkConfig } from './types.js'
import { loadGooglePay, loadApplePay } from './loader.js'
import { buildGoogleBaseRequest, getPaymentsClient } from './googlePay.js'

async function readyGooglePay(config: PaySdkConfig): Promise<true> {
  await loadGooglePay()
  if (!window.google?.payments?.api) {
    throw new Error('Google Pay JS failed to load')
  }

  const client = getPaymentsClient(config)
  const res = await client.isReadyToPay(buildGoogleBaseRequest(config))
  if (!res?.result) {
    throw new Error('Google Pay is not available for this user/environment')
  }
  return true
}

async function readyApplePay(): Promise<true> {
  await loadApplePay()

  if (typeof ApplePaySession === 'undefined') {
    throw new Error('Apple Pay is not supported in this browser')
  }
  if (!ApplePaySession.canMakePayments()) {
    throw new Error('Apple Pay cannot make payments on this device')
  }
  return true
}

export function ready(config: PaySdkConfig): Promise<true> {
  if (config.method === 'googlePay') return readyGooglePay(config)
  if (config.method === 'applePay') return readyApplePay()
  return Promise.reject(new Error(`Unknown payment method: ${config.method}`))
}
