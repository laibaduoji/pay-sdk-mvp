/**
 * 四个接口共用类型（响应壳、环境、订单状态等）。
 */

export type Environment = 'TEST' | 'PRODUCTION'
export type PayMethod = 'googlePay' | 'applePay'
export type ClientChannel = 'web' | 'webview' | 'android' | 'ios'

/** 业务成功时的 returnCode */
export const SUCCESS_RETURN_CODE = '0000' as const

/**
 * 四个接口统一响应壳。
 * - returnCode === '0000'：成功，读 data
 * - 其他 returnCode：失败，向用户/日志吐出 returnMsg（勿忽略）
 */
export interface ApiResponse<T = unknown> {
  success: boolean
  returnCode: string
  returnMsg: string
  extend?: string
  /** 成功时为业务数据；失败时可能为空对象或缺省 */
  data: T
  traceId?: string
}

/** 判断接口是否成功 */
export function isApiSuccess(res: ApiResponse): boolean {
  return res.returnCode === SUCCESS_RETURN_CODE
}

/** 订单状态（支付结果 / 查询订单共用） */
export type OrderStatus = 'pending' | 'requires_action' | 'succeeded' | 'failed'

/**
 * 支付接口告诉客户端下一步做什么。
 * - none：无页面动作（成功或失败看 status）
 * - redirect：打开 webUrl
 * - threeDS：WorldPay 等 3DS（md + jwt + threeDSAction），并轮询订单
 * - shift4Pay：Shift4 方法页，并轮询订单
 */
export type PayAction = 'none' | 'redirect' | 'threeDS' | 'shift4Pay'

export interface BillingAddress {
  name?: string
  address1?: string
  address2?: string
  locality?: string
  administrativeArea?: string
  postalCode?: string
  countryCode?: string
  phoneNumber?: string
  email?: string
}

/** 任意接口失败示例 */
export const apiFailureExample: ApiResponse<Record<string, never>> = {
  success: false,
  returnCode: '1001',
  returnMsg: 'order not found',
  extend: '',
  data: {},
  traceId: '68b11d63f919cca7adbb4bbe57939df9'
}
