import { ON_RAMP_ORDER_STATUS_MAP } from './types.js'

/** 失败态 → onError */
export const ORDER_STATE_FAIL = new Set([0, 6, 7, 8, 9, 10, 11])

/** 成功态 → onSuccess + onComplete */
export const ORDER_STATE_SUCCESS = new Set([2, 5])

/** PENDING；仅此态且未 s3dsComplete、无 s3dsUrl 时继续轮询 */
export const ORDER_STATE_PENDING = 1

export function orderStateLabel(orderState: number): string {
  return (
    ON_RAMP_ORDER_STATUS_MAP[orderState as keyof typeof ON_RAMP_ORDER_STATUS_MAP] ||
    `UNKNOWN_${orderState}`
  )
}

export function isValidS3dsUrl(url: unknown): url is string {
  return typeof url === 'string' && url.trim().length > 0
}
