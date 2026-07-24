import type {
  RiskCheckoutConfig,
  RiskFingerprintConfig,
  RiskForterConfig,
  RiskWorldPayConfig
} from '../types.js'

const FINGERPRINT_DEFAULTS: Required<RiskFingerprintConfig> = {
  apiKey: 'BhQq2qOOYR3oeMTEKIc2',
  scriptUrlPattern: ['https://fp.alchemypay.org/web/v3/BhQq2qOOYR3oeMTEKIc2/loader_v3.9.9.js'],
  endpoint: ['https://fp.alchemypay.org']
}

const FORTER_DEFAULTS: Required<Omit<RiskForterConfig, 'enabled'>> = {
  siteId: 'b132efccafac'
}

/** Risk.js SDK 3.3.1 — https://www.checkout.com/docs/developer-resources/sdks/risk-sdks/risk-js-sdk */
const CHECKOUT_PUBLIC_KEY_PROD = 'pk_aldlsnx6lhkjggag4qe2nff4c4h'
const CHECKOUT_PUBLIC_KEY_SANDBOX = 'pk_sbox_srkhzyxmotpo6vnfhqixvs66kyt'

const CHECKOUT_SCRIPT_PROD = 'https://risk.checkout.com/cdn/risk/3.3.1/risk.js'
const CHECKOUT_INTEGRITY_PROD =
  'sha384-bdtH448zhkYQQTsR0FB6/ITKVZ1zdSi5Dv5NN5AILI1ZBIMJFsqKs8Upm6bWD+DL'
const CHECKOUT_SCRIPT_SANDBOX = 'https://risk.sandbox.checkout.com/cdn/risk/3.3.1/risk.js'
const CHECKOUT_INTEGRITY_SANDBOX =
  'sha384-NuldQYGHmN12FhNL/QlNXZ2H+T00OYzfkbbS8s6MvxpqOQUzRg48p+av2KjO8Yut'

const WORLDPAY_ACTION_URL_DEFAULT = 'https://centinelapi.cardinalcommerce.com/V1/Cruise/Collect'

const WORLDPAY_DEFAULTS: Required<Omit<RiskWorldPayConfig, 'enabled'>> = {
  jwt: '',
  bin: '',
  actionUrl: WORLDPAY_ACTION_URL_DEFAULT
}

export function mergeFingerprintConfig(
  cfg?: RiskFingerprintConfig
): Required<RiskFingerprintConfig> {
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

export function mergeWorldPayConfig(
  cfg?: RiskWorldPayConfig
): Required<Omit<RiskWorldPayConfig, 'enabled'>> {
  return {
    jwt: cfg?.jwt || WORLDPAY_DEFAULTS.jwt,
    bin: cfg?.bin ?? WORLDPAY_DEFAULTS.bin,
    actionUrl: cfg?.actionUrl || WORLDPAY_DEFAULTS.actionUrl
  }
}
