/**
 * 接口 2 — Apple Pay 域名校验（仅 applePay）
 * POST {validateMerchantUrl} 或 POST /v1/pay/apple-pay/validate-merchant
 *
 * 客户端：returnCode==='0000' 时 completeMerchantValidation(response.data)
 * 其中 data 即为 Apple 下发的 merchantSession（opaque）。
 */

import type { ApiResponse } from './common'

export interface ValidateMerchantRequest {
  /** 建议带上，便于审计 */
  orderId?: string
  /** Apple onvalidatemerchant 给出的 validationURL，原样转发 */
  validationURL: string
}

/** Apple 返回的 opaque merchant session（字段对商户不透明） */
export type MerchantSession = Record<string, unknown>

/**
 * 统一响应壳；data = merchantSession。
 * 客户端：completeMerchantValidation(response.data)
 */
export type ValidateMerchantResponse = ApiResponse<MerchantSession>

export const validateMerchantRequestExample: ValidateMerchantRequest = {
  orderId: 'ord_xxx',
  validationURL: 'https://apple-pay-gateway.apple.com/paymentservices/startSession'
}

/** Apple opaque session，原样放进 data */
const merchantSession: MerchantSession = {/* Apple opaque merchantSession */}

export const validateMerchantResponseExample: ValidateMerchantResponse = {
  success: true,
  returnCode: '0000',
  returnMsg: 'SUCCESS',
  extend: '',
  data: merchantSession,
  traceId: '68b11d63f919cca7adbb4bbe57939df9'
}
