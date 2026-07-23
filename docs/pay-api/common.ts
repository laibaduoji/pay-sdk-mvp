/**
 * 四个接口共用类型（响应壳、环境、订单状态等）。
 */

export type Environment = 'TEST' | 'PRODUCTION'
export type PayMethod = 'googlePay' | 'applePay'

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

/** 订单状态（查询订单接口） */
export type OrderStatus = 'pending' | 'requires_action' | 'succeeded' | 'failed'

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

/** 任意接口失败示例 */
export const apiFailureExample: ApiResponse<Record<string, never>> = {
  success: false,
  returnCode: '1001',
  returnMsg: 'order not found',
  extend: '',
  data: {},
  traceId: '68b11d63f919cca7adbb4bbe57939df9'
}
