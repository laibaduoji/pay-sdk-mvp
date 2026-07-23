/**
 * 接口 4 — 查询订单状态
 * GET /v1/pay/orders/{orderId}（仅本接口为 GET；接口 1–3 均为 POST）
 *
 * 何时需要：支付接口进入 requires_action（webUrl / 3DS / shift4）之后。
 * 建议间隔 2s；外层 returnCode==='0000' 且 data.status 为 succeeded|failed 时停止。
 */

import type { ApiResponse, OrderStatus } from './common'

/** GET：orderId 走路径参数 */
export interface QueryOrderRequest {
  orderId: string
}

/** 查询订单成功时 data 载荷 */
export interface QueryOrderResponse {
  orderId: string
  paymentId?: string
  status: OrderStatus
  failureReason?: string
  /** 终态后可选：回商户页 */
  returnUrl?: string
}

export type QueryOrderApiResponse = ApiResponse<QueryOrderResponse>

export const queryOrderRequestExample: QueryOrderRequest = {
  orderId: 'ord_xxx'
}

export const queryOrderPendingExample: QueryOrderResponse = {
  orderId: 'ord_xxx',
  paymentId: 'pay_xxx',
  status: 'pending'
}

export const queryOrderSucceededExample: QueryOrderResponse = {
  orderId: 'ord_xxx',
  paymentId: 'pay_xxx',
  status: 'succeeded',
  returnUrl: 'https://merchant.example/pay/return'
}

export const queryOrderFailedExample: QueryOrderResponse = {
  orderId: 'ord_xxx',
  paymentId: 'pay_xxx',
  status: 'failed',
  failureReason: 'authentication_failed',
  returnUrl: 'https://merchant.example/pay/return'
}

export const queryOrderApiResponseSucceededExample: QueryOrderApiResponse = {
  success: true,
  returnCode: '0000',
  returnMsg: 'SUCCESS',
  extend: '',
  data: queryOrderSucceededExample,
  traceId: '68b11d63f919cca7adbb4bbe57939df9'
}
