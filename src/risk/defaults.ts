import type {
  RiskCheckoutConfig,
  RiskFingerprintConfig,
  RiskForterConfig,
  RiskWorldPayConfig
} from '../types.js'

/** SDK 内置默认；订单 risk 有值时覆盖 */
export const FINGERPRINT_DEFAULTS: Required<Omit<RiskFingerprintConfig, 'enabled'>> = {
  apiKey: 'BhQq2qOOYR3oeMTEKIc2',
  scriptUrlPattern: ['https://fp.alchemypay.org/web/v3/BhQq2qOOYR3oeMTEKIc2/loader_v3.9.9.js'],
  endpoint: ['https://fp.alchemypay.org']
}

export const FORTER_DEFAULTS: Required<Omit<RiskForterConfig, 'enabled'>> = {
  siteId: 'b132efccafac'
}

/** Risk.js SDK 3.3.1 — https://www.checkout.com/docs/developer-resources/sdks/risk-sdks/risk-js-sdk */
export const CHECKOUT_PUBLIC_KEY_PROD = 'pk_aldlsnx6lhkjggag4qe2nff4c4h'
export const CHECKOUT_PUBLIC_KEY_SANDBOX = 'pk_sbox_srkhzyxmotpo6vnfhqixvs66kyt'

export const CHECKOUT_SCRIPT_PROD = 'https://risk.checkout.com/cdn/risk/3.3.1/risk.js'
export const CHECKOUT_INTEGRITY_PROD =
  'sha384-bdtH448zhkYQQTsR0FB6/ITKVZ1zdSi5Dv5NN5AILI1ZBIMJFsqKs8Upm6bWD+DL'
export const CHECKOUT_SCRIPT_SANDBOX = 'https://risk.sandbox.checkout.com/cdn/risk/3.3.1/risk.js'
export const CHECKOUT_INTEGRITY_SANDBOX =
  'sha384-NuldQYGHmN12FhNL/QlNXZ2H+T00OYzfkbbS8s6MvxpqOQUzRg48p+av2KjO8Yut'

export const CHECKOUT_DEFAULTS: Required<Omit<RiskCheckoutConfig, 'enabled'>> = {
  publicKey: CHECKOUT_PUBLIC_KEY_PROD,
  scriptUrl: CHECKOUT_SCRIPT_PROD,
  integrity: CHECKOUT_INTEGRITY_PROD
}

export const WORLDPAY_DEFAULTS: Required<Omit<RiskWorldPayConfig, 'enabled'>> = {
  jwt: ''
}

export function mergeFingerprintConfig(
  cfg?: RiskFingerprintConfig
): Required<Omit<RiskFingerprintConfig, 'enabled'>> {
  return {
    apiKey: cfg?.apiKey || FINGERPRINT_DEFAULTS.apiKey,
    scriptUrlPattern: cfg?.scriptUrlPattern?.length
      ? cfg.scriptUrlPattern
      : FINGERPRINT_DEFAULTS.scriptUrlPattern,
    endpoint: cfg?.endpoint?.length ? cfg.endpoint : FINGERPRINT_DEFAULTS.endpoint
  }
}

export function mergeForterConfig(
  cfg?: RiskForterConfig
): Required<Omit<RiskForterConfig, 'enabled'>> {
  return {
    siteId: cfg?.siteId || FORTER_DEFAULTS.siteId
  }
}

export function mergeCheckoutConfig(
  cfg?: RiskCheckoutConfig,
  environment?: 'TEST' | 'PRODUCTION'
): Required<Omit<RiskCheckoutConfig, 'enabled'>> {
  const useSandbox =
    environment === 'TEST' || (!!cfg?.publicKey && cfg.publicKey.startsWith('pk_sbox_'))

  const publicKey =
    cfg?.publicKey || (useSandbox ? CHECKOUT_PUBLIC_KEY_SANDBOX : CHECKOUT_PUBLIC_KEY_PROD)

  const isSandboxKey = publicKey.startsWith('pk_sbox_')
  const scriptUrl =
    cfg?.scriptUrl || (isSandboxKey ? CHECKOUT_SCRIPT_SANDBOX : CHECKOUT_SCRIPT_PROD)

  let integrity = cfg?.integrity || ''
  if (!integrity) {
    if (scriptUrl === CHECKOUT_SCRIPT_SANDBOX) integrity = CHECKOUT_INTEGRITY_SANDBOX
    else if (scriptUrl === CHECKOUT_SCRIPT_PROD) integrity = CHECKOUT_INTEGRITY_PROD
  }

  return { publicKey, scriptUrl, integrity }
}
