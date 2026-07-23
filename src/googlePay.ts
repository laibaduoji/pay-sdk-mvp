import type { WalletPaySdkConfig } from './types.js'
import { normalizeGoogleResult, isGoogleCancel, toError } from './normalize.js'
import { collectRisk } from './risk/index.js'

const paymentsClients = new WeakMap<WalletPaySdkConfig, google.payments.api.PaymentsClient>()

function merchantInfo(config: WalletPaySdkConfig): google.payments.api.MerchantInfo {
  const gp = config.googlePay
  if (gp?.paymentDataRequest?.merchantInfo) {
    return gp.paymentDataRequest.merchantInfo
  }
  // merchantId is required by the type but only used in PRODUCTION; omit it in
  // TEST rather than sending an empty value.
  const info: Partial<google.payments.api.MerchantInfo> = {
    merchantName: gp?.merchantName || 'Merchant'
  }
  if (gp?.merchantId) info.merchantId = gp.merchantId
  return info as google.payments.api.MerchantInfo
}

export function getPaymentsClient(config: WalletPaySdkConfig): google.payments.api.PaymentsClient {
  const cached = paymentsClients.get(config)
  if (cached) return cached

  const client = new google.payments.api.PaymentsClient({
    environment: config.environment === 'TEST' ? 'TEST' : 'PRODUCTION',
    merchantInfo: merchantInfo(config)
  })
  paymentsClients.set(config, client)
  return client
}

function buildCardPaymentMethod(
  config: WalletPaySdkConfig
): google.payments.api.PaymentMethodSpecification {
  const gp = config.googlePay

  const parameters: google.payments.api.CardParameters = {
    allowedAuthMethods: gp?.allowedAuthMethods || ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
    allowedCardNetworks: gp?.allowedCardNetworks || ['MASTERCARD', 'VISA']
  }

  if (config.billingAddressRequired) {
    parameters.billingAddressRequired = true
    parameters.billingAddressParameters = {
      format: 'FULL',
      phoneNumberRequired: false
    }
  }

  return {
    type: 'CARD',
    parameters,
    tokenizationSpecification: gp!.tokenizationSpecification
  }
}

// Base request shared by isReadyToPay() and loadPaymentData().
export function buildGoogleBaseRequest(
  config: WalletPaySdkConfig
): google.payments.api.IsReadyToPayRequest {
  const request = config.googlePay?.paymentDataRequest
  return {
    apiVersion: request?.apiVersion || 2,
    apiVersionMinor: request?.apiVersionMinor || 0,
    allowedPaymentMethods: request?.allowedPaymentMethods || [buildCardPaymentMethod(config)]
  }
}

function buildPaymentDataRequest(
  config: WalletPaySdkConfig
): google.payments.api.PaymentDataRequest {
  const provided = config.googlePay?.paymentDataRequest
  if (provided) {
    return {
      ...provided,
      callbackIntents: (provided.callbackIntents || []).filter(
        (intent) => intent !== 'PAYMENT_AUTHORIZATION'
      )
    } as google.payments.api.PaymentDataRequest
  }

  const payment = config.payment
  return {
    apiVersion: 2,
    apiVersionMinor: 0,
    allowedPaymentMethods: [buildCardPaymentMethod(config)],
    merchantInfo: merchantInfo(config),
    transactionInfo: {
      countryCode: payment.countryCode,
      currencyCode: payment.currency,
      totalPriceStatus: 'FINAL',
      totalPrice: String(payment.amount),
      totalPriceLabel: 'Total'
    }
  }
}

function buttonOptions(
  config: WalletPaySdkConfig,
  onClick: () => void
): google.payments.api.ButtonOptions {
  const btn = config.googlePay?.button || {}
  const options: google.payments.api.ButtonOptions = {
    onClick,
    buttonColor: btn.buttonColor || 'default',
    buttonType: btn.buttonType || 'plain',
    buttonSizeMode: btn.buttonSizeMode || 'fill'
  }
  if (btn.buttonLocale) options.buttonLocale = btn.buttonLocale
  return options
}

export function createGoogleButton(config: WalletPaySdkConfig, onClick: () => void): HTMLElement {
  return getPaymentsClient(config).createButton(buttonOptions(config, onClick))
}

export async function payWithGoogle(config: WalletPaySdkConfig): Promise<void> {
  const client = getPaymentsClient(config)
  const riskPromise = collectRisk(config.risk, config.environment)
  try {
    const paymentData = await client.loadPaymentData(buildPaymentDataRequest(config))
    const risk = await riskPromise
    await config.onSuccess?.({ ...normalizeGoogleResult(paymentData), risk })
  } catch (err) {
    if (isGoogleCancel(err)) {
      config.onCancel?.()
      return
    }
    config.onError?.(toError(err))
  }
}
