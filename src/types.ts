export type PayMethod = 'googlePay' | 'applePay'

export type Environment = 'TEST' | 'PRODUCTION'

export interface PaymentConfig {
  amount: string
  currency: string
  countryCode: string
}

export interface GooglePayButtonConfig {
  buttonColor?: google.payments.api.ButtonColor
  buttonType?: google.payments.api.ButtonType
  buttonSizeMode?: google.payments.api.ButtonSizeMode
  buttonLocale?: string
}

export interface GooglePayConfig {
  merchantId?: string
  merchantName?: string
  allowedAuthMethods?: google.payments.api.CardAuthMethod[]
  allowedCardNetworks?: google.payments.api.CardNetwork[]
  tokenizationSpecification: google.payments.api.PaymentMethodTokenizationSpecification
  button?: GooglePayButtonConfig
}

export interface ApplePayButtonConfig {
  buttonstyle?: string
  type?: string
  locale?: string
}

export interface ApplePayConfig {
  validateMerchantUrl: string
  merchantCapabilities?: ApplePayJS.ApplePayMerchantCapability[]
  supportedNetworks?: string[]
  button?: ApplePayButtonConfig
}

/** 创建订单下发 / init 传入的风控配置（与 docs/pay-api 对齐） */
export interface RiskFingerprintConfig {
  enabled?: boolean
  apiKey?: string
  scriptUrlPattern?: string[]
  endpoint?: string[]
}

export interface RiskForterConfig {
  enabled?: boolean
  siteId?: string
}

export interface RiskCheckoutConfig {
  enabled?: boolean
  publicKey?: string
  /** 覆盖 Risk.js CDN；缺省按 publicKey（pk_sbox_ → sandbox）选择 */
  scriptUrl?: string
  /** SRI；自定义 scriptUrl 时可一并覆盖 */
  integrity?: string
}

export interface RiskWorldPayConfig {
  enabled?: boolean
  jwt?: string
}

export interface CreateOrderRisk {
  fingerprint?: RiskFingerprintConfig
  forter?: RiskForterConfig
  checkout?: RiskCheckoutConfig
  worldPay?: RiskWorldPayConfig
}

/** 采集结果，商户组 PayRequest.risk 时使用 */
export interface PayRiskPayload {
  fingerprint?: { visitorId: string }
  forter?: { token: string }
  checkout?: { deviceSessionId: string }
  worldPay?: { sessionId: string }
}

export interface GooglePayResult {
  method: 'googlePay'
  token?: string
  paymentMethodData?: google.payments.api.PaymentMethodData
  billingAddress?: google.payments.api.Address
  email?: string
  raw: google.payments.api.PaymentData
  risk?: PayRiskPayload
}

export interface ApplePayResult {
  method: 'applePay'
  token?: ApplePayJS.ApplePayPaymentToken
  billingContact?: ApplePayJS.ApplePayPaymentContact
  shippingContact?: ApplePayJS.ApplePayPaymentContact
  raw: ApplePayJS.ApplePayPayment
  risk?: PayRiskPayload
}

export type PayResult = GooglePayResult | ApplePayResult

export interface PaySdkConfig {
  method: PayMethod
  container: string | HTMLElement
  payment: PaymentConfig
  environment?: Environment
  billingAddressRequired?: boolean
  googlePay?: GooglePayConfig
  applePay?: ApplePayConfig
  /** 创建订单返回的 risk；enabled 块才会采集 */
  risk?: CreateOrderRisk
  onSuccess?: (result: PayResult) => void
  onError?: (error: Error) => void
  onCancel?: () => void
}
