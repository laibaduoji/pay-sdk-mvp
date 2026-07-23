/**
 * 接口 2 — Apple Pay 域名校验（仅 applePay）
 * POST {validateMerchantUrl} 或 POST /v1/pay/apple-pay/validate-merchant
 *
 * 客户端：returnCode==='0000' 时 completeMerchantValidation(response.data)
 */

import type { ApiResponse } from './common'

export interface ValidateMerchantRequest {
  /** 建议带上，便于审计 */
  orderId?: string
  /** Apple onvalidatemerchant 给出的 validationURL，原样转发 */
  validationURL: string
}

/**
 * 与现有 Web SDK 一致：Apple opaque session 放在 data 下。
 */
export type ValidateMerchantResponse = ApiResponse<Record<string, unknown>>

export const validateMerchantRequestExample: ValidateMerchantRequest = {
  orderId: 'ord_xxx',
  validationURL: 'https://apple-pay-gateway.apple.com/paymentservices/startSession'
}

export const validateMerchantResponseExample: ValidateMerchantResponse = {
  success: true,
  returnCode: '0000',
  returnMsg: 'SUCCESS',
  extend: '',
  data: {/* Apple opaque merchantSession */},
  traceId: '68b11d63f919cca7adbb4bbe57939df9'
}
