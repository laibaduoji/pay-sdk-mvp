/**
 * Shared demo configuration.
 * Edit these values once — example pages read from window.PaySdkDemoConfig.
 */
window.PaySdkDemoConfig = {
  payment: {
    amount: '1',
    currency: 'USD',
    countryCode: 'US',
    network: 'BSC',
    cryptoCurrency: 'USDC',
    address: '0x1c16531598b5fefd76faed0aa5627e6068a5a1bd'
  },

  googlePay: {
    /**
     * Google Pay TEST — Unlimint PAYMENT_GATEWAY（与 live create-order 一致）
     * 勿用 Shift4 DIRECT 的 merchantId(123456…) 搭配 unlimint，WebView 下易异常。
     */
    merchantName: 'Example Merchant',
    merchantId: '863513232473669406',
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
  },

  /** TEST openapi 联调默认凭据（仅 demo；生产勿用） */
  api: {
    appId: 'ahzxh0klegv1fzol',
    appSecret: 'py2bwighth62ajq6'
  }
}
