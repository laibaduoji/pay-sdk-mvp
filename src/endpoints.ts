import type { Environment, PayApiConfig } from './types.js'

/** 环境对应的 API 根域名（不常改，集中维护） */
const API_BASE: Record<Environment, string> = {
  TEST: 'https://openapi-test.alchemypay.org',
  PRODUCTION: 'https://openapi.alchemypay.org'
}

/** 接口相对路径（相对根域名） */
const API_PATHS = {
  getToken: '/open/api/v4/merchant/getToken',
  createOrder: '/open/api/v4/merchant/order/create',
  validateMerchant: '/open/api/v4/merchant/domain/verify',
  pay: '/open/api/v4/merchant/alchemy-pay',
  queryOrder: '/open/api/v4/merchant/order/detail'
} as const

export type PayApiEndpoints = Pick<
  PayApiConfig,
  'getTokenUrl' | 'createOrderUrl' | 'validateMerchantUrl' | 'payUrl' | 'queryOrderUrl'
>

/** 按环境取内置接口地址 */
export function getApiEndpoints(environment: Environment = 'PRODUCTION'): PayApiEndpoints {
  const base = API_BASE[environment]
  return {
    getTokenUrl: `${base}${API_PATHS.getToken}`,
    createOrderUrl: `${base}${API_PATHS.createOrder}`,
    validateMerchantUrl: `${base}${API_PATHS.validateMerchant}`,
    payUrl: `${base}${API_PATHS.pay}`,
    queryOrderUrl: `${base}${API_PATHS.queryOrder}`
  }
}

/**
 * 合并内置地址与商户覆盖项（headers / poll / 自定义 URL / 签名凭证）。
 * 未传的 URL 使用对应环境的内置地址。
 */
export function resolvePayApiConfig(
  environment: Environment,
  overrides?: Partial<PayApiConfig>
): PayApiConfig {
  const defaults = getApiEndpoints(environment)
  return {
    getTokenUrl: overrides?.getTokenUrl || defaults.getTokenUrl,
    createOrderUrl: overrides?.createOrderUrl || defaults.createOrderUrl,
    validateMerchantUrl: overrides?.validateMerchantUrl || defaults.validateMerchantUrl,
    payUrl: overrides?.payUrl || defaults.payUrl,
    queryOrderUrl: overrides?.queryOrderUrl || defaults.queryOrderUrl,
    accessToken: overrides?.accessToken,
    appId: overrides?.appId,
    appSecret: overrides?.appSecret,
    headers: overrides?.headers,
    getFingerprintId: overrides?.getFingerprintId,
    fetch: overrides?.fetch,
    pollIntervalMs: overrides?.pollIntervalMs,
    pollTimeoutMs: overrides?.pollTimeoutMs
  }
}

export function resolveEnvironment(environment?: Environment): Environment {
  return environment === 'TEST' ? 'TEST' : 'PRODUCTION'
}
