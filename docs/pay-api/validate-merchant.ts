/**
 * 接口 2 — Apple Pay 域名校验（仅 applePay）
 * POST {validateMerchantUrl}；未下发时使用当前环境内置地址
 * （`/open/api/v4/merchant/domain/verify`，见 SDK `src/endpoints.ts`）
 *
 * 对齐 Apifox SDK 目录接口：请求 `orderNo` + `validationURL` 均为必填。
 * 客户端：returnCode==='0000' 时 completeMerchantValidation(response.data)
 * 其中 data 即为 Apple 下发的 merchantSession（opaque）。
 */

import type { ApiResponse } from './common'

export interface ValidateMerchantRequest {
  /** 创建订单返回的订单号 */
  orderNo: string
  /** Apple onvalidatemerchant 给出的 validationURL，原样转发 */
  validationURL: string
}

/**
 * Apple 返回的 opaque merchant session（字段对商户不透明，原样传给 Apple）。
 * 以下为常见键示意，以实际响应为准。
 */
export type MerchantSession = Record<string, unknown>

/**
 * 统一响应壳；data = merchantSession。
 * 客户端：completeMerchantValidation(response.data)
 */
export type ValidateMerchantResponse = ApiResponse<MerchantSession>

export const validateMerchantRequestExample: ValidateMerchantRequest = {
  orderNo: 'ord_xxx',
  validationURL: 'https://apple-pay-gateway.apple.com/paymentservices/startSession'
}

/** Apple opaque session 示意（对齐 Apifox 成功示例字段） */
const merchantSession: MerchantSession = {
  epochTimestamp: 1728461305683,
  expiresAt: 1728464905683,
  merchantSessionIdentifier:
    'SSH05B54D411631466D9542B93941E05E23_A0E617ED4A56A343E07C6E1255BD4098423B3A8E1243236462D07B14B4A0F7C3',
  nonce: 'bbb64401',
  merchantIdentifier: 'A0A833BAC15813A005A54FE28FE9E236A0594BFEDF0EDCD7A4DCEB278A2F0CAE',
  domainName: 'ramp.alchemypay.org',
  displayName: 'rampservice',
  signature: '308006092a864886f70d010702a0803080020101...',
  operationalAnalyticsIdentifier:
    'rampservice:A0A833BAC15813A005A54FE28FE9E236A0594BFEDF0EDCD7A4DCEB278A2F0CAE',
  retries: 0,
  pspId: 'A0A833BAC15813A005A54FE28FE9E236A0594BFEDF0EDCD7A4DCEB278A2F0CAE'
}

export const validateMerchantResponseExample: ValidateMerchantResponse = {
  success: true,
  returnCode: '0000',
  returnMsg: 'SUCCESS',
  extend: '',
  data: merchantSession,
  traceId: '68b11d63f919cca7adbb4bbe57939df9'
}
