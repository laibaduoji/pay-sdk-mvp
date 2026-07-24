/**
 * 接口 3 — 支付
 * POST /v1/pay/payments
 *
 * 先看外层 returnCode==='0000'，再看 data 里是否有二次动作字段：
 * 1) 无 webUrl / MD+JWT+action / threeDSMethodData+methodUrl → 成功结束，不调接口 4
 * 2) 有上述字段 → 打开对应页面，轮询接口 4
 * 接口失败（returnCode!=='0000'）看 returnMsg，不调接口 4
 */

import type { ApiResponse, BillingAddress } from './common'

/** 支付上送的风控采集结果（仅创建订单里 enabled 的块；Fingerprint 走请求头 fingerprint-id） */
export interface PayRiskPayload {
  forter?: { token: string }
  checkout?: { deviceSessionId: string }
  worldPay?: { sessionId: string }
}

export interface PayRequest {
  orderId: string
  /** Google Pay：加密 token 字符串；Apple Pay：payment.token 对象或序列化字符串 */
  encryptedData: string | Record<string, unknown>
  billingAddress?: BillingAddress
  risk?: PayRiskPayload
}

/**
 * 支付成功时 data 载荷。
 * 字段有值则走对应二次动作；都无则直接成功。
 */
export interface PayResponse {
  /** WorldPay 等 3DS */
  MD?: string
  JWT?: string
  /** 3DS 表单提交地址（配合 MD / JWT） */
  action?: string
  /** 普通跳转 */
  webUrl?: string
  /** Shift4 等方法页 */
  threeDSMethodData?: string
  methodUrl?: string
}

export type PayApiResponse = ApiResponse<PayResponse>

/**
 * afterPay(res):
 *   if returnCode !== '0000' → onError(returnMsg)
 *   else if data.webUrl → open(webUrl); poll 接口 4
 *   else if data.MD && data.JWT && data.action → openThreeDSPage(...); poll 接口 4
 *   else if data.threeDSMethodData && data.methodUrl → openShift4Page(...); poll 接口 4
 *   else → onSuccess()
 */

export const payRequestExample: PayRequest = {
  orderId: 'ord_xxx',
  encryptedData: '...google pay encrypted token...',
  billingAddress: {
    addressLine1: '1 Main St',
    addressLine2: '',
    city: 'San Francisco',
    state: 'CA',
    zip: '94105',
    country: 'US',
    firstName: 'Jane',
    lastName: 'Doe',
    phone: '+1...',
    email: 'jane@example.com'
  },
  risk: {
    forter: { token: 'your forter token' },
    checkout: { deviceSessionId: 'dsid_...' },
    worldPay: { sessionId: 'your worldPay sessionId' }
  }
}

export const payRequestMinimal: PayRequest = {
  orderId: 'ord_xxx',
  encryptedData: {/* Apple Pay payment.token */}
}

/** 直接成功 → 不必调接口 4 */
export const payResponseSucceeded: PayResponse = {}

/** 普通 webUrl → 打开页面 + 轮询接口 4 */
export const payResponseWebUrl: PayResponse = {
  webUrl: 'https://psp.example/checkout/xxx'
}

/** 3DS（MD/JWT/action）→ 打开 3DS 页 + 轮询接口 4 */
export const payResponseThreeDS: PayResponse = {
  MD: '...',
  JWT: '...',
  action: 'https://acs.example/challenge'
}

/** Shift4 → 方法页 + 轮询接口 4 */
export const payResponseShift4: PayResponse = {
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
