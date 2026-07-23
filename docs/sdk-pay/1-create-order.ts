/**
 * 接口 1 — 创建订单
 * POST /v1/pay/orders（路径建议，以实际网关为准）
 *
 * 响应 data 含 params（见 sdk-pay.md §1–3）与 risk（§4）。
 * environment 可选，不传默认 'PRODUCTION'。
 * risk 配置：有值覆盖 SDK 默认，无值用默认。
 */

import type { ApiResponse, Environment, PayMethod } from './common'

// ─────────────────────────────────────────────
// 钱包 params（对照 md §1–3）
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
    totalPriceLabel?: string
  }
  merchantInfo: {
    merchantId?: string
    merchantName?: string
  }
  /** 可选；不需要授权回调时不要带 */
  callbackIntents?: string[]
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
}

export interface RiskWorldPayConfig {
  enabled?: boolean
  jwt?: string
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

export interface CreateOrderRequest {
  merchantOrderId: string
  amount: string
  currency: string
  countryCode: string
  method: PayMethod
  billingAddressRequired?: boolean
  /** 3DS / webUrl 完成后回商户页 */
  returnUrl?: string
  customer?: { email?: string; id?: string }
  metadata?: Record<string, unknown>
}

export interface CreateOrderResponseGooglePay {
  orderId: string
  method: 'googlePay'
  /** 不传时客户端按 PRODUCTION */
  environment?: Environment
  params: GooglePayParams
  risk?: CreateOrderRisk
  returnUrl?: string
}

export interface CreateOrderResponseApplePay {
  orderId: string
  method: 'applePay'
  environment?: Environment
  params: ApplePayParams
  /** Apple onvalidatemerchant 时调用的服务端地址（接口 2） */
  validateMerchantUrl: string
  risk?: CreateOrderRisk
  returnUrl?: string
}

/** 创建订单成功时 data 载荷 */
export type CreateOrderResponse = CreateOrderResponseGooglePay | CreateOrderResponseApplePay

export type CreateOrderApiResponse = ApiResponse<CreateOrderResponse>

/** @deprecated 使用 CreateOrderResponse */
export type CreateOrderData = CreateOrderResponse

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
          publicKey: 'your publicKey'
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
    merchantId: 'your merchantId',
    merchantName: 'your merchantName'
  },
  callbackIntents: ['PAYMENT_AUTHORIZATION']
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
          publicKey: 'your publicKey'
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
  merchantInfo: { merchantName: 'your merchantName' }
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
          gateway: 'your gateway',
          gatewayMerchantId: 'your gatewayMerchantId'
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
    merchantId: 'your merchantId',
    merchantName: 'your merchantName'
  },
  callbackIntents: ['PAYMENT_AUTHORIZATION']
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
    apiKey: 'your fingerprint apiKey',
    scriptUrlPattern: ['https://fp.example.com/web/v3/yourApiKey/loader_v3.9.9.js'],
    endpoint: ['https://fp.example.com']
  },
  forter: { enabled: true, siteId: 'your forter siteId' },
  checkout: { enabled: true, publicKey: 'your checkout public key' },
  worldPay: { enabled: true, jwt: 'your worldPayJwt' }
}

export const riskCollectNone: CreateOrderRisk = {
  fingerprint: { enabled: false },
  forter: { enabled: false },
  checkout: { enabled: false },
  worldPay: { enabled: false }
}

export const createOrderRequestExample: CreateOrderRequest = {
  merchantOrderId: 'm_20260723_001',
  amount: '10.00',
  currency: 'USD',
  countryCode: 'US',
  method: 'googlePay',
  billingAddressRequired: true,
  returnUrl: 'https://merchant.example/pay/return',
  customer: { email: 'u@example.com', id: 'c_123' }
}

export const createOrderResponseGooglePayDirect: CreateOrderResponseGooglePay = {
  orderId: 'ord_xxx',
  environment: 'TEST',
  method: 'googlePay',
  params: googlePayParamsDirect,
  risk: riskCollectAll,
  returnUrl: 'https://merchant.example/pay/return'
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
  validateMerchantUrl: 'https://api.example.com/v1/pay/apple-pay/validate-merchant',
  risk: riskCollectAll,
  returnUrl: 'https://merchant.example/pay/return'
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
