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
    merchantName: 'Alchemy Pay Ramp',
    /** Required when environment is PRODUCTION (example 8.4) */
    merchantId: 'BCR2DN4TQTA5V4YV', //BCR2DN5TRCG6H2QZ
    /** PAYMENT_GATEWAY mode */
    gateway: 'example',
    gatewayMerchantId: 'exampleGatewayMerchantId',
    /** Used by PRODUCTION example (8.4) */
    productionGateway: 'unlimint',
    productionGatewayMerchantId: 'BCR2DN4TQTA5V4YV',
    /** DIRECT mode public key (replace with your real key) */
    publicKey:
      'BE6v5sWsfYnUTgU+21rbWKcCAgPBuN8aR7k3b2tq+UMF6iuwHS1Px3maVxaRdbxUOn1HYuMWQ6Uvhc6/OhXE/p4='
  },

  applePay: {
    validateMerchantUrl: 'https://api-test.alchemytech.cc/pay/apple/domainName/verify'
  }
}
