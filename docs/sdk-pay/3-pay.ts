/**
 * 接口 3 — 支付
 * POST /v1/pay/payments
 *
 * 先看外层 returnCode==='0000'，再看 data.status / action：
 * 1) status=succeeded 且 action=none → 成功结束，不调接口 4
 * 2) status=failed 且 action=none → 失败，不调接口 4
 * 3) status=requires_action（webUrl / 3DS / shift4）→ 打开对应页面，轮询接口 4
 */

import type {
  ApiResponse,
  BillingAddress,
  ClientChannel,
  OrderStatus,
  PayAction,
  PayMethod
} from './common'

/** 支付上送的风控采集结果（仅创建订单里 enabled 的块需要带） */
export interface PayRiskPayload {
  fingerprint?: { visitorId: string }
  forter?: { token: string }
  checkout?: { deviceSessionId: string }
  worldPay?: { sessionId: string }
}

export interface PayRequest {
  orderId: string
  method: PayMethod
  /** Google Pay：token 字符串；Apple Pay：payment.token 对象或序列化字符串 */
  token: string | Record<string, unknown>
  billingAddress?: BillingAddress
  email?: string
  risk?: PayRiskPayload
  clientChannel?: ClientChannel
  rawWalletPayload?: unknown
}

/** 支付成功时 data 载荷 */
export interface PayResponse {
  orderId: string
  paymentId?: string
  status: OrderStatus
  action: PayAction
  failureReason?: string

  /** action=redirect：整页或新窗口打开 */
  webUrl?: string

  /** action=threeDS：md + jwt → threeDSAction，并轮询订单 */
  md?: string
  jwt?: string
  threeDSAction?: string

  /** action=shift4Pay：方法页 + 轮询订单 */
  threeDSMethodData?: string
  methodUrl?: string
}

export type PayApiResponse = ApiResponse<PayResponse>

/**
 * afterPay(data):
 *   if succeeded + none → onSuccess()
 *   if failed → onError(failureReason)
 *   if requires_action → open page + poll 接口 4
 */

export const payRequestExample: PayRequest = {
  orderId: 'ord_xxx',
  method: 'googlePay',
  token: '...google pay token string...',
  email: 'u@example.com',
  billingAddress: {
    name: 'Jane Doe',
    address1: '1 Main St',
    locality: 'San Francisco',
    administrativeArea: 'CA',
    postalCode: '94105',
    countryCode: 'US',
    phoneNumber: '+1...'
  },
  risk: {
    fingerprint: { visitorId: 'your visitor id' },
    forter: { token: 'your forter token' },
    checkout: { deviceSessionId: 'dsid_...' },
    worldPay: { sessionId: 'your worldPay sessionId' }
  },
  clientChannel: 'web'
}

export const payRequestMinimal: PayRequest = {
  orderId: 'ord_xxx',
  method: 'applePay',
  token: {/* Apple Pay payment.token */},
  clientChannel: 'web'
}

/** 直接成功 → 不必调接口 4 */
export const payResponseSucceeded: PayResponse = {
  orderId: 'ord_xxx',
  paymentId: 'pay_xxx',
  status: 'succeeded',
  action: 'none'
}

/** 普通 webUrl → 打开页面 + 轮询接口 4 */
export const payResponseWebUrl: PayResponse = {
  orderId: 'ord_xxx',
  paymentId: 'pay_xxx',
  status: 'requires_action',
  action: 'redirect',
  webUrl: 'https://psp.example/checkout/xxx'
}

/** 3DS（md/jwt）→ 打开 3DS 页 + 轮询接口 4 */
export const payResponseThreeDS: PayResponse = {
  orderId: 'ord_xxx',
  paymentId: 'pay_xxx',
  status: 'requires_action',
  action: 'threeDS',
  md: '...',
  jwt: '...',
  threeDSAction: 'https://acs.example/challenge'
}

/** Shift4 → 方法页 + 轮询接口 4 */
export const payResponseShift4: PayResponse = {
  orderId: 'ord_xxx',
  paymentId: 'pay_xxx',
  status: 'requires_action',
  action: 'shift4Pay',
  threeDSMethodData: '...',
  methodUrl: 'https://psp.example/3ds-method'
}

export const payApiResponseSucceededExample: PayApiResponse = {
  success: true,
  returnCode: '0000',
  returnMsg: 'SUCCESS',
  extend: '',
  data: payResponseSucceeded,
  traceId: '68b11d63f919cca7adbb4bbe57939df9'
}

export const payApiResponseWebUrlExample: PayApiResponse = {
  success: true,
  returnCode: '0000',
  returnMsg: 'SUCCESS',
  extend: '',
  data: payResponseWebUrl,
  traceId: '68b11d63f919cca7adbb4bbe57939df9'
}
