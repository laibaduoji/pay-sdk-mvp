/**
 * 接口 4 — 查询订单状态
 * GET /payment-hub/order/detail（仅本接口为 GET；接口 1–3 均为 POST）
 * Apifox 493859900 + H5 轮询逻辑
 *
 * 何时需要：支付接口进入二次动作（webUrl / 3DS / shift4）之后。
 * 建议间隔 2s；停止条件见下方轮询说明。
 * 无 query；订单由请求头 payment-hub-token 标识。
 */

import type { ApiResponse } from './common'

/** GET：无 body / query；凭请求头 payment-hub-token */
export type QueryOrderRequest = Record<string, never>

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

/** 查询订单成功时 data 载荷 */
export interface QueryOrderResponse {
  orderNo: string
  /** 业务状态码；兼容读 orderStatus（H5） */
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

export type QueryOrderApiResponse = ApiResponse<QueryOrderResponse>

/**
 * 轮询停止（对齐 H5）：
 *
 * 1. 有效 s3dsUrl → onAction；导航成功则停轮询
 * 2. orderState !== 1 或 s3dsComplete === true → 停轮询
 * 3. 仅 orderState === 1 且未 complete、无导航离开时继续
 *
 * 停表后回调：
 * - {0,6,7,8,9,10,11} → onError
 * - {2,5} → onSuccess + onComplete
 * - 其它非 pending / 仅 s3dsComplete → onComplete
 */

export const queryOrderRequestExample: QueryOrderRequest = {}

export const queryOrderPendingExample: QueryOrderResponse = {
  orderNo: 'ord_xxx',
  orderState: 1,
  s3dsComplete: false,
  fiatCurrency: 'USD',
  fiatCurrencyAmount: 100,
  payWayCode: '10001',
  channelCode: 'SHIFT4',
  redirectUrl: 'https://merchant.example/return',
  appId: 'your-app-id',
  needPopup: false,
  popupCode: ''
}

/** 轮询中出现银行 3DS 挑战 */
export const queryOrderS3dsUrlExample: QueryOrderResponse = {
  orderNo: 'ord_xxx',
  orderState: 1,
  s3dsUrl: 'https://acs.example/challenge',
  s3dsComplete: false
}

export const queryOrderSucceededExample: QueryOrderResponse = {
  orderNo: 'ord_xxx',
  orderState: 2,
  s3dsComplete: true,
  paymentInfoExtend: {
    isWorldPay: 0,
    worldPayJwt: null,
    s2sRiskCheck: false
  },
  kycInfoExtend: {
    webUrl: '',
    isDoKyc: false,
    currKycStatus: 0
  }
}

export const queryOrderFailedExample: QueryOrderResponse = {
  orderNo: 'ord_xxx',
  orderState: 0,
  failureReason: 'authentication_failed',
  s3dsComplete: true
}

export const queryOrderApiResponseSucceededExample: QueryOrderApiResponse = {
  success: true,
  returnCode: '0000',
  returnMsg: 'SUCCESS',
  extend: '',
  data: queryOrderSucceededExample,
  traceId: '68b11d63f919cca7adbb4bbe57939df9'
}
