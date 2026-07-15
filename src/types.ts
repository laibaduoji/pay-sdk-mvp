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

export interface GooglePayResult {
  method: 'googlePay'
  token?: string
  paymentMethodData?: google.payments.api.PaymentMethodData
  billingAddress?: google.payments.api.Address
  email?: string
  raw: google.payments.api.PaymentData
}

export interface ApplePayResult {
  method: 'applePay'
  token?: ApplePayJS.ApplePayPaymentToken
  billingContact?: ApplePayJS.ApplePayPaymentContact
  shippingContact?: ApplePayJS.ApplePayPaymentContact
  raw: ApplePayJS.ApplePayPayment
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
  onSuccess?: (result: PayResult) => void
  onError?: (error: Error) => void
  onCancel?: () => void
}
