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
  /** 完整编排模式下注入，用于携带 orderNo、统一响应壳及自定义 headers。 */
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

/** 创建订单请求（对齐 Apifox SDK 目录 `/open/api/v4/merchant/order/create`） */
export interface CreateOrderRequest {
  /** onramp: BUY / offramp: SELL */
  side: string
  /** 商户自定义订单号，需保证唯一 */
  merchantOrderNo: string
  amount: string
  /** 法币，如 USD/EUR */
  fiatCurrency: string
  /** ISO 3166-1 alpha-2；offramp 必填 */
  alpha2?: string
  /** 加密货币大写名，如 USDT */
  cryptoCurrency: string
  /** onramp: 4 / offramp: 6 */
  orderType: string
  /** onramp 收款地址 */
  address?: string
  /** 网络，如 ETH/BSC/BTC */
  network: string
  /** 支付方式：credit card 10001 / apple pay 501 / google pay 701 */
  payWayCode: string
  userAccountId?: string
  redirectUrl: string
  callbackUrl: string
  memo?: string
  extendParams?: Record<string, unknown>
  /** 用户 IPV4 */
  clientIp: string
  /** 0=onChain 1=internal，默认 0 */
  withdrawType?: number
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
  /** 部分服务端会把环境塞进 paymentScript；SDK 会提升到 order.environment */
  environment?: Environment
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
  orderNo: string
  method: 'googlePay'
  environment?: Environment
  paymentScript: GooglePayParams
  risk?: CreateOrderRisk
}

export interface CreateOrderResponseApplePay {
  orderNo: string
  method: 'applePay'
  environment?: Environment
  paymentScript: ApplePayParams
  /** 可选覆盖；未下发时使用当前环境在 endpoints.ts 中的内置地址。 */
  validateMerchantUrl?: string
  risk?: CreateOrderRisk
}

export type CreateOrderResponse = CreateOrderResponseGooglePay | CreateOrderResponseApplePay

/** 支付 customParam：token + 扁平账单字段（对齐 ramp-vue） */
export interface PayCustomParam {
  encryptedData: string
  addressLine1?: string
  addressLine2?: string
  city?: string
  state?: string
  zip?: string
  country?: string
  firstName?: string
  lastName?: string
}

export interface PayBusinessParams {
  /** Forter cookie / token */
  cookie?: string
  /** Checkout Risk device session id */
  checkoutCookie?: string
  dob?: string
}

export interface PayPoaParams {
  address?: string
  city?: string
  state?: string
  postcode?: string
  country?: string
}

/** POST /alchemy-pay 请求体（对齐 ramp-vue postAlchemyPay） */
export interface PayRequest {
  orderNo: string
  customParam: PayCustomParam
  businessParams?: PayBusinessParams
  /** WorldPay DDC sessionId */
  sessionId?: string
  /** 有账单时由账单映射；SDK 不单独采居住地址 */
  poaParams?: PayPoaParams
}

export interface PayResponse {
  MD?: string
  JWT?: string
  action?: string
  webUrl?: string
  threeDSMethodData?: string
  methodUrl?: string
}

/** On-ramp orderState → 文案（对齐 H5 ON_RAMP_ORDER_STATUS_MAP） */
export const ON_RAMP_ORDER_STATUS_MAP = {
  0: 'PAY_FAIL',
  1: 'PENDING',
  2: 'PAY_SUCCESS',
  3: 'TRANSFER',
  4: 'TRANSFER',
  5: 'FINISHED',
  6: 'CANCEL',
  7: 'PAY_FAIL',
  8: 'RISK_CONTROL',
  9: 'REFUNDED',
  10: 'REFUNDED',
  11: 'PAY_FAIL'
} as const

export type OnRampOrderStatusLabel =
  (typeof ON_RAMP_ORDER_STATUS_MAP)[keyof typeof ON_RAMP_ORDER_STATUS_MAP]

export interface QueryOrderPaymentInfoExtend {
  isWorldPay?: number
  worldPayJwt?: string | null
  s2sRiskCheck?: boolean
}

export interface QueryOrderKycInfoExtend {
  webUrl?: string
  isDoKyc?: boolean
  currKycStatus?: number
}

/** GET order/detail 响应 data（Apifox 493859900 + H5 s3dsUrl） */
export interface QueryOrderResponse {
  orderNo: string
  orderState: number
  /** H5 轮询使用；Apifox schema 可能未列出 */
  s3dsUrl?: string
  s3dsComplete?: boolean
  fiatCurrency?: string
  fiatCurrencyAmount?: number
  amount?: number
  toUsdXR?: number | null
  payWayCode?: string
  channelCode?: string
  redirectUrl?: string
  appId?: string
  usdToXR?: number | null
  merchantOrderNo?: string | null
  alpha2?: string
  cardNo?: string | null
  cvv?: string | null
  usdAmount?: number
  createdTime?: number
  payTime?: number | null
  updatedTime?: number
  cryptoCurrency?: string
  cryptoCurrencyQuantity?: string
  paymentInfoExtend?: QueryOrderPaymentInfoExtend | null
  kycInfoExtend?: QueryOrderKycInfoExtend | null
  needPopup?: boolean
  popupCode?: string
  failureReason?: string
}

export interface PayApiConfig {
  createOrderUrl: string
  /** Apple Pay 域名校验地址。 */
  validateMerchantUrl: string
  payUrl: string
  /**
   * 订单详情 base URL（无 query）。
   * SDK 自动追加 `?orderNo=`（值为创建订单返回的 orderNo）。
   */
  queryOrderUrl: string
  /** Get Token 地址；默认按环境内置。 */
  getTokenUrl: string
  /**
   * 免登 accessToken；有值时写入请求头 `access-token`。
   * 建议商户服务端 getToken 后传入，避免 SDK 再调 getToken 拖慢出按钮。
   */
  accessToken?: string
  /** AlchemyPay 合作方 appId；与 appSecret 同时存在时自动签名（请求头 `appid`）。 */
  appId?: string
  /** AlchemyPay appSecret；仅用于 HMAC，勿在文档外泄露。 */
  appSecret?: string
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
  orderNo?: string
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
  orderNo?: string
  paymentResponse?: PayResponse
  order?: QueryOrderResponse
}

export type PayResult = GooglePayResult | ApplePayResult

export interface PaySdkInstance {
  ready(): Promise<true>
  mount(): this
  /** 商户授权后可让 SDK（或内置实现）打开二次动作页面 */
  openAction(action: PaymentAction): void
  /** 最近一次 openapi 响应的 traceId（成功或失败） */
  getLastTraceId(): string | undefined
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
   * 建议：商户服务端 [Get Token](https://alchemypay.readme.io/docs/get-token) 后传入。
   * 有值时 SDK 不再请求 getToken，可更快渲染支付按钮。
   */
  accessToken?: string
  /**
   * 未传 `accessToken` 时，与 `uid` 二选一：由 SDK 代调 getToken（会多一次网络往返）。
   */
  email?: string
  /**
   * 未传 `accessToken` 时，与 `email` 二选一：商户侧用户 UUID。
   */
  uid?: string
  /**
   * SDK 运行环境，默认 `PRODUCTION`。
   * 决定内置 API 地址、Google Pay 环境、Checkout Risk 沙盒/生产等。
   */
  environment?: Environment
  /**
   * 可选。默认按 `environment` 使用内置接口地址（见 `src/endpoints.ts`）。
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
