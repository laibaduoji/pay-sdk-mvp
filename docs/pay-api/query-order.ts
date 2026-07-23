/**
 * 接口 4 — 查询订单状态
 * GET /v1/pay/orders/{orderId}（仅本接口为 GET；接口 1–3 均为 POST）
 *
 * 何时需要：支付接口进入 requires_action（webUrl / 3DS / shift4）之后。
 * 建议间隔 2s；停止条件见下方轮询说明。
 */

import type { ApiResponse, OrderStatus } from './common'

/** GET：orderId 走路径参数 */
export interface QueryOrderRequest {
  orderId: string
}

/** 查询订单成功时 data 载荷 */
export interface QueryOrderResponse {
  orderId: string
  status: OrderStatus
  failureReason?: string
  /** 有值：跳转该 URL 继续完成 3DS 验证（可仍继续轮询） */
  s3dsUrl?: string
  /** true：3DS 已完成，与终态一样应停止轮询并通知商户跳结果页 */
  s3dsComplete?: boolean
}

export type QueryOrderApiResponse = ApiResponse<QueryOrderResponse>

/**
 * 轮询订单状态（建议间隔 2s；外层 returnCode 须为 '0000'）：
 *
 * 1. 若有 s3dsUrl → 跳转 s3dsUrl，继续完成验证（轮询可继续）
 * 2. 若 status 为终态（succeeded | failed），或 s3dsComplete === true
 *      → 停止轮询，通知商户跳转对应结果页
 * 3. 否则继续轮询
 */

export const queryOrderRequestExample: QueryOrderRequest = {
  orderId: 'ord_xxx'
}

export const queryOrderPendingExample: QueryOrderResponse = {
  orderId: 'ord_xxx',
  status: 'pending',
  s3dsComplete: false
}

/** 轮询中出现银行 3DS 挑战 */
export const queryOrderS3dsUrlExample: QueryOrderResponse = {
  orderId: 'ord_xxx',
  status: 'pending',
  s3dsUrl: 'https://acs.example/challenge',
  s3dsComplete: false
}

export const queryOrderSucceededExample: QueryOrderResponse = {
  orderId: 'ord_xxx',
  status: 'succeeded',
  s3dsComplete: true
}

export const queryOrderFailedExample: QueryOrderResponse = {
  orderId: 'ord_xxx',
  status: 'failed',
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
