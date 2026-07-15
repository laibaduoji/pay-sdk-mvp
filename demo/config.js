/**
 * Shared demo configuration.
 * Edit these values once — example pages read from window.PaySdkDemoConfig.
 */
window.PaySdkDemoConfig = {
  payment: {
    amount: '10.00',
    currency: 'USD',
    countryCode: 'US'
  },

  googlePay: {
    merchantName: 'Demo Merchant',
    /** Required when environment is PRODUCTION (example 8.4) */
    merchantId: 'BCR2XXXXXXXXXXXXXX',
    /** PAYMENT_GATEWAY mode */
    gateway: 'example',
    gatewayMerchantId: 'exampleGatewayMerchantId',
    /** Used by PRODUCTION example (8.4) */
    productionGateway: 'stripe',
    productionGatewayMerchantId: 'acct_123',
    /** DIRECT mode public key (replace with your real key) */
    publicKey: 'BOdoXP+9Aq473S...'
  },

  applePay: {
    validateMerchantUrl: 'https://your-server.com/apple-pay/session'
  }
}
