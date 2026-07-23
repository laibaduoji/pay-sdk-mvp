import type { Environment, PayApiConfig } from './types.js'

/** 环境对应的 API 根域名（不常改，集中维护） */
const API_BASE: Record<Environment, string> = {
  TEST: 'https://api-test.alchemytech.cc',
  PRODUCTION: 'https://api.alchemypay.org'
}

/** 四接口相对路径（相对根域名） */
const API_PATHS = {
  createOrder: '/v1/pay/orders',
  validateMerchant: '/pay/apple/domainName/verify',
  pay: '/v1/pay/payments',
  queryOrder: '/v1/pay/orders/{orderId}'
} as const

export type PayApiEndpoints = Pick<
  PayApiConfig,
  'createOrderUrl' | 'validateMerchantUrl' | 'payUrl' | 'queryOrderUrl'
>

/** 按环境取内置四接口地址 */
export function getApiEndpoints(environment: Environment = 'PRODUCTION'): PayApiEndpoints {
  const base = API_BASE[environment]
  return {
    createOrderUrl: `${base}${API_PATHS.createOrder}`,
    validateMerchantUrl: `${base}${API_PATHS.validateMerchant}`,
    payUrl: `${base}${API_PATHS.pay}`,
    queryOrderUrl: `${base}${API_PATHS.queryOrder}`
  }
}

/**
 * 合并内置地址与商户覆盖项（headers / poll / 自定义 URL）。
 * 未传的 URL 使用对应环境的内置地址。
 */
export function resolvePayApiConfig(
  environment: Environment,
  overrides?: Partial<PayApiConfig>
): PayApiConfig {
  const defaults = getApiEndpoints(environment)
  return {
    createOrderUrl: overrides?.createOrderUrl || defaults.createOrderUrl,
    validateMerchantUrl: overrides?.validateMerchantUrl || defaults.validateMerchantUrl,
    payUrl: overrides?.payUrl || defaults.payUrl,
    queryOrderUrl: overrides?.queryOrderUrl || defaults.queryOrderUrl,
    headers: overrides?.headers,
    fetch: overrides?.fetch,
    pollIntervalMs: overrides?.pollIntervalMs,
    pollTimeoutMs: overrides?.pollTimeoutMs
  }
}

export function resolveEnvironment(environment?: Environment): Environment {
  return environment === 'TEST' ? 'TEST' : 'PRODUCTION'
}
