export type PayMethod = 'googlePay' | 'applePay'

export type Environment = 'TEST' | 'PRODUCTION'

export type OrderStatus = 'pending' | 'requires_action' | 'succeeded' | 'failed'

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
  /** 创建订单下发的完整 Google PaymentDataRequest 参数。 */
  paymentDataRequest?: GooglePayParams
  button?: GooglePayButtonConfig
}

export interface ApplePayButtonConfig {
  buttonstyle?: string
  type?: string
  locale?: string
}

export interface ApplePayConfig {
  validateMerchantUrl: string
  /** 完整编排模式下注入，用于携带 orderId、统一响应壳及自定义 headers。 */
  validateMerchant?: (validationURL: string) => Promise<Record<string, unknown>>
  merchantCapabilities?: ApplePayJS.ApplePayMerchantCapability[]
  supportedNetworks?: string[]
  totalLabel?: string
  totalType?: ApplePayJS.ApplePayLineItemType
  /** 创建订单下发的完整 ApplePayPaymentRequest 参数。 */
  paymentRequest?: ApplePayParams
  button?: ApplePayButtonConfig
}

export interface BillingAddress {
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  zip: string
  country: string
  firstName: string
  lastName: string
  phone?: string
  email?: string
}

/** SDK 内部 Fingerprint 采集参数（非创建订单契约；用 defaults 合并） */
export interface RiskFingerprintConfig {
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
  /** Cardinal / WorldPay DDC JWT（创建订单下发） */
  jwt?: string
  /** 卡 BIN；钱包支付可空 */
  bin?: string
  /** DDC Collect URL，可覆盖 */
  actionUrl?: string
}

/** 创建订单下发的风控开关（Fingerprint 由 SDK 独立采集，不在此） */
export interface CreateOrderRisk {
  forter?: RiskForterConfig
  checkout?: RiskCheckoutConfig
  worldPay?: RiskWorldPayConfig
}

/** 支付 body 风控采集结果（Fingerprint 仅走请求头 fingerprint-id） */
export interface PayRiskPayload {
  forter?: { token: string }
  checkout?: { deviceSessionId: string }
  worldPay?: { sessionId: string }
}

export interface ApiResponse<T = unknown> {
  success: boolean
  returnCode: string
  returnMsg: string
  extend?: string
  data: T
  traceId?: string
}

export interface CreateOrderRequest {
  amount: string
  currency: string
  countryCode: string
}

export interface GooglePayParams {
  apiVersion: number
  apiVersionMinor: number
  allowedPaymentMethods: google.payments.api.PaymentMethodSpecification[]
  transactionInfo: google.payments.api.TransactionInfo
  merchantInfo: google.payments.api.MerchantInfo
  /**
   * SDK 固定为 `['PAYMENT_AUTHORIZATION']`（创建订单下发会被覆盖）。
   * 并配置 PaymentsClient.paymentDataCallbacks.onPaymentAuthorized。
   */
  callbackIntents?: google.payments.api.CallbackIntent[]
}

export interface ApplePayParams {
  countryCode: string
  currencyCode: string
  merchantCapabilities: ApplePayJS.ApplePayMerchantCapability[]
  supportedNetworks: string[]
  total: ApplePayJS.ApplePayLineItem
  requiredBillingContactFields?: ApplePayJS.ApplePayContactField[]
}

export interface CreateOrderResponseGooglePay {
  orderId: string
  method: 'googlePay'
  environment?: Environment
  params: GooglePayParams
  risk?: CreateOrderRisk
}

export interface CreateOrderResponseApplePay {
  orderId: string
  method: 'applePay'
  environment?: Environment
  params: ApplePayParams
  /** 可选覆盖；未下发时使用当前环境在 endpoints.ts 中的内置地址。 */
  validateMerchantUrl?: string
  risk?: CreateOrderRisk
}

export type CreateOrderResponse = CreateOrderResponseGooglePay | CreateOrderResponseApplePay

export interface PayRequest {
  orderId: string
  encryptedData: string | Record<string, unknown>
  billingAddress?: BillingAddress
  risk?: PayRiskPayload
}

export interface PayResponse {
  MD?: string
  JWT?: string
  action?: string
  webUrl?: string
  threeDSMethodData?: string
  methodUrl?: string
}

export interface QueryOrderResponse {
  orderId: string
  status: OrderStatus
  failureReason?: string
  s3dsUrl?: string
  s3dsComplete?: boolean
}

export interface PayApiConfig {
  createOrderUrl: string
  /** Apple Pay 域名校验地址。 */
  validateMerchantUrl: string
  payUrl: string
  /**
   * 查询地址。支持 `/orders/{orderId}` 模板；无占位符时自动追加
   * `/{encodeURIComponent(orderId)}`。
   */
  queryOrderUrl: string
  headers?:
    Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>)
  /**
   * SDK 内部：解析 Fingerprint visitorId，写入请求头 `fingerprint-id`。
   * 空字符串时不带头。
   */
  getFingerprintId?: () => Promise<string>
  fetch?: typeof fetch
  pollIntervalMs?: number
  /** 轮询最长等待；默认 5 分钟 */
  pollTimeoutMs?: number
}

export type PaymentAction =
  | {
      type: 'webUrl'
      url: string
      webUrl: string
    }
  | {
      type: 'threeDS'
      url: string
      MD: string
      JWT: string
      action: string
    }
  | {
      type: 'threeDSMethod'
      url: string
      threeDSMethodData: string
      methodUrl: string
    }
  | {
      type: 's3ds'
      url: string
      s3dsUrl: string
    }

/**
 * 二次动作处理方式（完整编排模式）：
 * - callback（默认）：只通过 onAction 吐给商户，适合 App WebView
 * - auto：先尝试 openAction（如 JS Bridge），未处理再用 SDK 内置打开
 */
export type PaymentActionMode = 'callback' | 'auto'

export interface GooglePayResult {
  method: 'googlePay'
  token?: string
  paymentMethodData?: google.payments.api.PaymentMethodData
  billingAddress?: google.payments.api.Address
  email?: string
  raw: google.payments.api.PaymentData
  risk?: PayRiskPayload
  orderId?: string
  paymentResponse?: PayResponse
  order?: QueryOrderResponse
}

export interface ApplePayResult {
  method: 'applePay'
  token?: ApplePayJS.ApplePayPaymentToken
  billingContact?: ApplePayJS.ApplePayPaymentContact
  shippingContact?: ApplePayJS.ApplePayPaymentContact
  raw: ApplePayJS.ApplePayPayment
  risk?: PayRiskPayload
  orderId?: string
  paymentResponse?: PayResponse
  order?: QueryOrderResponse
}

export type PayResult = GooglePayResult | ApplePayResult

export interface PaySdkInstance {
  ready(): Promise<true>
  mount(): this
  /** 商户授权后可让 SDK（或内置实现）打开二次动作页面 */
  openAction(action: PaymentAction): void
  destroy(): void
}

interface PaySdkCallbacks {
  onSuccess?: (result: PayResult) => void | Promise<void>
  /** 支付编排结束；包括 succeeded 或 s3dsComplete 但状态尚未终态。 */
  onComplete?: (result: PayResult) => void
  onError?: (error: Error) => void
  onCancel?: () => void
  onOrderCreated?: (order: CreateOrderResponse) => void
  onStatusChange?: (order: QueryOrderResponse) => void
  /**
   * 风控相关回调：Fingerprint（请求头用）settle 与/或订单侧其它风控预采集结束。
   * `fingerprintId` 为 visitorId（可能为空）；`risk` 为支付 body 用 payload（不含 fingerprint）。
   */
  onRiskCollected?: (info: { fingerprintId?: string; risk: PayRiskPayload }) => void
  /**
   * 需要打开 webUrl / 3DS / method / s3ds 时回调。
   * WebView 场景下建议商户自行处理；也可稍后调用 sdk.openAction(action)。
   */
  onAction?: (action: PaymentAction) => void
}

interface PaySdkBaseConfig extends PaySdkCallbacks {
  container: string | HTMLElement
}

/**
 * `PaySdk.init` 配置：创建订单 → 钱包授权 → 支付 → 查询。
 * 钱包参数与 risk 均来自创建订单响应，不再支持仅钱包初始化。
 */
export interface PaySdkConfig extends PaySdkBaseConfig {
  order: CreateOrderRequest
  /**
   * SDK 运行环境，默认 `PRODUCTION`。
   * 决定内置 API 地址、Google Pay 环境、Checkout Risk 沙盒/生产等。
   */
  environment?: Environment
  /**
   * 可选。默认按 `environment` 使用内置四接口地址（见 `src/endpoints.ts`）。
   * 可只传 `headers` / 轮询配置，或覆盖个别 URL（如本地代理）。
   */
  api?: Partial<PayApiConfig>
  /**
   * 二次动作默认 callback：只通知商户。
   * auto：尝试 openAction / SDK 内置打开。
   */
  actionMode?: PaymentActionMode
  /**
   * 自定义打开器（如 Native JS Bridge）。
   * 返回 true 表示已处理，SDK 不再使用内置打开。
   */
  openAction?: (action: PaymentAction) => boolean | void | Promise<boolean | void>
}

/** @deprecated 使用 `PaySdkConfig` */
export type ApiPaySdkConfig = PaySdkConfig

/**
 * 创建订单成功后的内部运行时配置（供 Google/Apple 模块使用，非 init 入参）。
 */
export interface RuntimeWalletConfig {
  container: string | HTMLElement
  method: PayMethod
  payment: PaymentConfig
  environment?: Environment
  billingAddressRequired?: boolean
  googlePay?: GooglePayConfig
  applePay?: ApplePayConfig
  risk?: CreateOrderRisk
  /** 创建订单后启动的预采集；支付时复用 / await */
  riskCollection?: Promise<PayRiskPayload>
  onSuccess?: (result: PayResult) => void | Promise<void>
  onError?: (error: Error) => void
  onCancel?: () => void
}
