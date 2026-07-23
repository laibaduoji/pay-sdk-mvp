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
    /** Google Pay TEST defaults (aligned with SDK GOOGLE_PAY_TEST_DEFAULTS) */
    merchantName: 'Example Merchant',
    merchantId: '12345678901234567890',
    gateway: 'unlimint',
    gatewayMerchantId: 'googletest',
    /** PRODUCTION sample */
    productionMerchantName: 'Alchemy Pay Ramp',
    productionMerchantId: 'BCR2DN4TQTA5V4YV',
    productionGateway: 'unlimint',
    productionGatewayMerchantId: 'BCR2DN4TQTA5V4YV',
    publicKey:
      'BE6v5sWsfYnUTgU+21rbWKcCAgPBuN8aR7k3b2tq+UMF6iuwHS1Px3maVxaRdbxUOn1HYuMWQ6Uvhc6/OhXE/p4='
  },

  applePay: {
    validateMerchantUrl: 'https://api-test.alchemytech.cc/pay/apple/domainName/verify'
  }
}
