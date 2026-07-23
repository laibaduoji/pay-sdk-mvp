/**
 * 接口 1 — 创建订单
 * POST /v1/pay/orders（路径建议，以实际网关为准）
 *
 * 响应 data 含 params（Google / Apple 原生唤起参数）与 risk。
 * environment 可选，不传默认 'PRODUCTION'。
 * risk 配置：有值覆盖 SDK 默认，无值用默认。
 * 说明见 README.md。
 */

import type { ApiResponse, Environment } from './common'

// ─────────────────────────────────────────────
// 钱包 params
// ─────────────────────────────────────────────

export interface GooglePayParams {
  apiVersion: number
  apiVersionMinor: number
  allowedPaymentMethods: Array<{
    type: 'CARD'
    parameters: {
      allowedAuthMethods: string[]
      allowedCardNetworks: string[]
      billingAddressRequired?: boolean
      billingAddressParameters?: {
        format: 'FULL' | 'MIN'
        phoneNumberRequired?: boolean
      }
    }
    tokenizationSpecification:
      | {
          type: 'DIRECT'
          parameters: { protocolVersion: string; publicKey: string }
        }
      | {
          type: 'PAYMENT_GATEWAY'
          parameters: { gateway: string; gatewayMerchantId: string }
        }
  }>
  transactionInfo: {
    countryCode: string
    currencyCode: string
    totalPriceStatus: string
    totalPrice: string
    totalPriceLabel: string
  }
  merchantInfo: {
    merchantId: string
    merchantName: string
  }
  callbackIntents: string[]
}

export interface ApplePayParams {
  countryCode: string
  currencyCode: string
  merchantCapabilities: string[]
  supportedNetworks: string[]
  total: { label: string; type: string; amount: string }
  requiredBillingContactFields?: string[]
}

// ─────────────────────────────────────────────
// 风控（创建订单下发）
// ─────────────────────────────────────────────

export interface RiskFingerprintConfig {
  enabled?: boolean
  apiKey?: string
  scriptUrlPattern?: string[]
  endpoint?: string[]
}

export interface RiskForterConfig {
  enabled?: boolean
  siteId?: string
}

export interface RiskCheckoutConfig {
  enabled?: boolean
  publicKey?: string
  /** 覆盖 Risk.js CDN；缺省按 publicKey（pk_sbox_ → sandbox）选择 */
  scriptUrl?: string
  /** SRI；自定义 scriptUrl 时可一并覆盖 */
  integrity?: string
}

export interface RiskWorldPayConfig {
  enabled?: boolean
  /** Cardinal / WorldPay DDC JWT（创建订单下发） */
  jwt?: string
  /** 卡 BIN；钱包支付可空 */
  bin?: string
  /** DDC Collect URL，可覆盖 */
  actionUrl?: string
}

export interface CreateOrderRisk {
  fingerprint?: RiskFingerprintConfig
  forter?: RiskForterConfig
  checkout?: RiskCheckoutConfig
  worldPay?: RiskWorldPayConfig
}

// ─────────────────────────────────────────────
// 请求 / 响应
// ─────────────────────────────────────────────

/** 创建订单请求（其余字段暂未冻结，后续再补） */
export interface CreateOrderRequest {
  amount: string
  currency: string
  countryCode: string
}

export interface CreateOrderResponseGooglePay {
  orderId: string
  method: 'googlePay'
  /** 不传时客户端按 PRODUCTION */
  environment?: Environment
  params: GooglePayParams
  risk?: CreateOrderRisk
}

export interface CreateOrderResponseApplePay {
  orderId: string
  method: 'applePay'
  environment?: Environment
  params: ApplePayParams
  /** 可选覆盖；未下发时 SDK 使用当前环境的内置接口 2 地址 */
  validateMerchantUrl?: string
  risk?: CreateOrderRisk
}

/** 创建订单成功时 data 载荷 */
export type CreateOrderResponse = CreateOrderResponseGooglePay | CreateOrderResponseApplePay

export type CreateOrderApiResponse = ApiResponse<CreateOrderResponse>

// ─────────────────────────────────────────────
// 示例
// ─────────────────────────────────────────────

export const googlePayParamsDirect: GooglePayParams = {
  apiVersion: 2,
  apiVersionMinor: 0,
  allowedPaymentMethods: [
    {
      type: 'CARD',
      parameters: {
        allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
        allowedCardNetworks: ['MASTERCARD', 'VISA'],
        billingAddressRequired: true,
        billingAddressParameters: {
          format: 'FULL',
          phoneNumberRequired: false
        }
      },
      tokenizationSpecification: {
        type: 'DIRECT',
        parameters: {
          protocolVersion: 'ECv2',
          publicKey:
            'BE6v5sWsfYnUTgU+21rbWKcCAgPBuN8aR7k3b2tq+UMF6iuwHS1Px3maVxaRdbxUOn1HYuMWQ6Uvhc6/OhXE/p4='
        }
      }
    }
  ],
  transactionInfo: {
    countryCode: 'US',
    currencyCode: 'USD',
    totalPriceStatus: 'FINAL',
    totalPrice: '10.00',
    totalPriceLabel: 'Total'
  },
  merchantInfo: {
    merchantId: 'BCR2DN5TRCG6H2QZ',
    merchantName: 'Alchemy Pay Ramp'
  },
  callbackIntents: []
}

export const googlePayParamsDirectMinimal: GooglePayParams = {
  apiVersion: 2,
  apiVersionMinor: 0,
  allowedPaymentMethods: [
    {
      type: 'CARD',
      parameters: {
        allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
        allowedCardNetworks: ['MASTERCARD', 'VISA']
      },
      tokenizationSpecification: {
        type: 'DIRECT',
        parameters: {
          protocolVersion: 'ECv2',
          publicKey:
            'BE6v5sWsfYnUTgU+21rbWKcCAgPBuN8aR7k3b2tq+UMF6iuwHS1Px3maVxaRdbxUOn1HYuMWQ6Uvhc6/OhXE/p4='
        }
      }
    }
  ],
  transactionInfo: {
    countryCode: 'US',
    currencyCode: 'USD',
    totalPriceStatus: 'FINAL',
    totalPrice: '10.00',
    totalPriceLabel: 'Total'
  },
  merchantInfo: {
    merchantId: 'BCR2DN5TRCG6H2QZ',
    merchantName: 'Alchemy Pay Ramp'
  },
  callbackIntents: []
}

export const googlePayParamsGateway: GooglePayParams = {
  apiVersion: 2,
  apiVersionMinor: 0,
  allowedPaymentMethods: [
    {
      type: 'CARD',
      parameters: {
        allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
        allowedCardNetworks: ['MASTERCARD', 'VISA'],
        billingAddressRequired: true,
        billingAddressParameters: {
          format: 'FULL',
          phoneNumberRequired: false
        }
      },
      tokenizationSpecification: {
        type: 'PAYMENT_GATEWAY',
        parameters: {
          gateway: 'unlimint',
          gatewayMerchantId: 'BCR2DN4TQTA5V4YV'
        }
      }
    }
  ],
  transactionInfo: {
    countryCode: 'US',
    currencyCode: 'USD',
    totalPriceStatus: 'FINAL',
    totalPrice: '10.00',
    totalPriceLabel: 'Total'
  },
  merchantInfo: {
    merchantId: 'BCR2DN4TQTA5V4YV',
    merchantName: 'ramp'
  },
  callbackIntents: []
}

export const applePayParams: ApplePayParams = {
  countryCode: 'US',
  currencyCode: 'USD',
  merchantCapabilities: ['supports3DS', 'supportsCredit', 'supportsDebit'],
  supportedNetworks: ['masterCard', 'visa'],
  total: {
    label: 'ALCHEMY GPS EUROPE UAB',
    type: 'final',
    amount: '10.00'
  },
  requiredBillingContactFields: ['name', 'postalAddress', 'phone', 'email']
}

export const applePayParamsMinimal: ApplePayParams = {
  countryCode: 'US',
  currencyCode: 'USD',
  merchantCapabilities: ['supports3DS', 'supportsCredit', 'supportsDebit'],
  supportedNetworks: ['masterCard', 'visa'],
  total: {
    label: 'ALCHEMY GPS EUROPE UAB',
    type: 'final',
    amount: '10.00'
  }
}

export const riskCollectAll: CreateOrderRisk = {
  fingerprint: {
    enabled: true,
    apiKey: 'BhQq2qOOYR3oeMTEKIc2',
    scriptUrlPattern: ['https://fp.alchemypay.org/web/v3/BhQq2qOOYR3oeMTEKIc2/loader_v3.9.9.js'],
    endpoint: ['https://fp.alchemypay.org']
  },
  forter: { enabled: true, siteId: 'b132efccafac' },
  // 生产默认 pk_aldlsnx6lhkjggag4qe2nff4c4h；沙盒默认 pk_sbox_srkhzyxmotpo6vnfhqixvs66kyt（environment=TEST）
  checkout: { enabled: true, publicKey: 'pk_aldlsnx6lhkjggag4qe2nff4c4h' },
  worldPay: { enabled: true, jwt: 'your worldPayJwt' }
}

export const riskCollectNone: CreateOrderRisk = {
  fingerprint: { enabled: false },
  forter: { enabled: false },
  checkout: { enabled: false },
  worldPay: { enabled: false }
}

export const createOrderRequestExample: CreateOrderRequest = {
  amount: '10.00',
  currency: 'USD',
  countryCode: 'US'
}

export const createOrderResponseGooglePayDirect: CreateOrderResponseGooglePay = {
  orderId: 'ord_xxx',
  environment: 'TEST',
  method: 'googlePay',
  params: googlePayParamsDirect,
  risk: riskCollectAll
}

export const createOrderResponseGooglePayGateway: CreateOrderResponseGooglePay = {
  orderId: 'ord_xxx',
  environment: 'TEST',
  method: 'googlePay',
  params: googlePayParamsGateway,
  risk: riskCollectAll
}

export const createOrderResponseApplePay: CreateOrderResponseApplePay = {
  orderId: 'ord_xxx',
  environment: 'TEST',
  method: 'applePay',
  params: applePayParams,
  validateMerchantUrl: 'https://api-test.alchemytech.cc/pay/apple/domainName/verify',
  risk: riskCollectAll
}

export const createOrderResponseMinimalNoRisk: CreateOrderResponseGooglePay = {
  orderId: 'ord_xxx',
  method: 'googlePay',
  params: googlePayParamsDirectMinimal,
  risk: riskCollectNone
}

/** 完整成功报文示意 */
export const createOrderApiResponseExample: CreateOrderApiResponse = {
  success: true,
  returnCode: '0000',
  returnMsg: 'SUCCESS',
  extend: '',
  data: createOrderResponseGooglePayDirect,
  traceId: '68b11d63f919cca7adbb4bbe57939df9'
}
