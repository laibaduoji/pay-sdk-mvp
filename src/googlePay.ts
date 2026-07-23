import type { GooglePayParams, RuntimeWalletConfig } from './types.js'
import { normalizeGoogleResult, isGoogleCancel, toError } from './normalize.js'
import { resolveRiskCollection } from './risk/index.js'

/** Google Pay TEST 环境默认（创建订单未下发时补齐） */
export const GOOGLE_PAY_TEST_DEFAULTS = {
  merchantId: '12345678901234567890',
  merchantName: 'Example Merchant',
  gateway: 'unlimint',
  gatewayMerchantId: 'googletest'
} as const

const paymentsClients = new WeakMap<RuntimeWalletConfig, google.payments.api.PaymentsClient>()

/**
 * TEST 环境下补齐 merchantInfo / PAYMENT_GATEWAY 缺省字段。
 * 响应已有值则保留；无 tokenization 时默认 PAYMENT_GATEWAY。
 */
export function applyGooglePayTestDefaults(params: GooglePayParams): GooglePayParams {
  const merchantInfo: google.payments.api.MerchantInfo = {
    ...params.merchantInfo,
    merchantId: params.merchantInfo?.merchantId || GOOGLE_PAY_TEST_DEFAULTS.merchantId,
    merchantName: params.merchantInfo?.merchantName || GOOGLE_PAY_TEST_DEFAULTS.merchantName
  }

  const allowedPaymentMethods = (params.allowedPaymentMethods || []).map((method) => {
    const spec = method.tokenizationSpecification
    if (!spec) {
      return {
        ...method,
        tokenizationSpecification: {
          type: 'PAYMENT_GATEWAY' as const,
          parameters: {
            gateway: GOOGLE_PAY_TEST_DEFAULTS.gateway,
            gatewayMerchantId: GOOGLE_PAY_TEST_DEFAULTS.gatewayMerchantId
          }
        }
      }
    }
    if (spec.type !== 'PAYMENT_GATEWAY') return method
    const parameters = {
      ...spec.parameters,
      gateway: spec.parameters?.gateway || GOOGLE_PAY_TEST_DEFAULTS.gateway,
      gatewayMerchantId:
        spec.parameters?.gatewayMerchantId || GOOGLE_PAY_TEST_DEFAULTS.gatewayMerchantId
    }
    return {
      ...method,
      tokenizationSpecification: { type: 'PAYMENT_GATEWAY' as const, parameters }
    }
  })

  if (allowedPaymentMethods.length === 0) {
    allowedPaymentMethods.push({
      type: 'CARD',
      parameters: {
        allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
        allowedCardNetworks: ['MASTERCARD', 'VISA']
      },
      tokenizationSpecification: {
        type: 'PAYMENT_GATEWAY',
        parameters: {
          gateway: GOOGLE_PAY_TEST_DEFAULTS.gateway,
          gatewayMerchantId: GOOGLE_PAY_TEST_DEFAULTS.gatewayMerchantId
        }
      }
    })
  }

  return {
    ...params,
    merchantInfo,
    allowedPaymentMethods
  }
}

function merchantInfo(config: RuntimeWalletConfig): google.payments.api.MerchantInfo {
  const gp = config.googlePay
  if (gp?.paymentDataRequest?.merchantInfo) {
    const info = gp.paymentDataRequest.merchantInfo
    if (config.environment === 'TEST') {
      return {
        ...info,
        merchantId: info.merchantId || GOOGLE_PAY_TEST_DEFAULTS.merchantId,
        merchantName: info.merchantName || GOOGLE_PAY_TEST_DEFAULTS.merchantName
      }
    }
    return info
  }
  const info: Partial<google.payments.api.MerchantInfo> = {
    merchantName:
      gp?.merchantName ||
      (config.environment === 'TEST' ? GOOGLE_PAY_TEST_DEFAULTS.merchantName : 'Merchant')
  }
  const merchantId =
    gp?.merchantId ||
    (config.environment === 'TEST' ? GOOGLE_PAY_TEST_DEFAULTS.merchantId : undefined)
  if (merchantId) info.merchantId = merchantId
  return info as google.payments.api.MerchantInfo
}

export function getPaymentsClient(config: RuntimeWalletConfig): google.payments.api.PaymentsClient {
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
  config: RuntimeWalletConfig
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
  config: RuntimeWalletConfig
): google.payments.api.IsReadyToPayRequest {
  const request = config.googlePay?.paymentDataRequest
  return {
    apiVersion: request?.apiVersion || 2,
    apiVersionMinor: request?.apiVersionMinor || 0,
    allowedPaymentMethods: request?.allowedPaymentMethods || [buildCardPaymentMethod(config)]
  }
}

function buildPaymentDataRequest(
  config: RuntimeWalletConfig
): google.payments.api.PaymentDataRequest {
  const provided = config.googlePay?.paymentDataRequest
  if (provided) {
    const base = {
      ...provided,
      callbackIntents: (provided.callbackIntents || []).filter(
        (intent) => intent !== 'PAYMENT_AUTHORIZATION'
      )
    } as google.payments.api.PaymentDataRequest
    return config.environment === 'TEST'
      ? (applyGooglePayTestDefaults(
          base as GooglePayParams
        ) as google.payments.api.PaymentDataRequest)
      : base
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
  config: RuntimeWalletConfig,
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

export function createGoogleButton(config: RuntimeWalletConfig, onClick: () => void): HTMLElement {
  return getPaymentsClient(config).createButton(buttonOptions(config, onClick))
}

export async function payWithGoogle(config: RuntimeWalletConfig): Promise<void> {
  const client = getPaymentsClient(config)
  const riskPromise = resolveRiskCollection(config)
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
