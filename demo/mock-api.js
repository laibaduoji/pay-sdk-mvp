/**
 * Managed-flow demo mock for /v1/pay/* (and Apple validate path).
 * Driven by checkbox options; plug in via api.fetch.
 */
;(function (global) {
  const SUCCESS = {
    success: true,
    returnCode: '0000',
    returnMsg: 'SUCCESS',
    extend: '',
    traceId: 'demo-mock-trace'
  }

  const cfg = global.PaySdkDemoConfig || {
    payment: { amount: '10.00', currency: 'USD', countryCode: 'US' },
    googlePay: {
      merchantName: 'Alchemy Pay Ramp',
      merchantId: 'BCR2DN4TQTA5V4YV',
      gateway: 'example',
      gatewayMerchantId: 'exampleGatewayMerchantId',
      publicKey:
        'BE6v5sWsfYnUTgU+21rbWKcCAgPBuN8aR7k3b2tq+UMF6iuwHS1Px3maVxaRdbxUOn1HYuMWQ6Uvhc6/OhXE/p4='
    }
  }

  /** @type {Record<string, { ticks: number, options: object }>} */
  const orders = Object.create(null)

  let options = {
    environment: 'TEST',
    method: 'googlePay',
    billingAddress: false,
    forter: false,
    checkout: false,
    worldPay: false,
    payOutcome: 'success',
    actionMode: 'callback',
    omitValidateUrl: true
  }

  function envelope(data) {
    return { ...SUCCESS, data }
  }

  function jsonResponse(body, status) {
    return new Response(JSON.stringify(body), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  function buildRisk() {
    return {
      forter: options.forter ? { enabled: true, siteId: 'b132efccafac' } : { enabled: false },
      // 不传 publicKey：由 SDK 按 environment 选沙盒/生产默认 key
      checkout: options.checkout ? { enabled: true } : { enabled: false },
      worldPay: options.worldPay
        ? {
            enabled: true,
            jwt: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.demo.worldpay'
          }
        : { enabled: false }
    }
  }

  function googleParams(request) {
    const amount = (request && request.amount) || cfg.payment.amount
    const currency = (request && (request.fiatCurrency || request.currency)) || cfg.payment.currency
    const countryCode =
      (request && (request.alpha2 || request.countryCode)) || cfg.payment.countryCode
    const isProd = options.environment === 'PRODUCTION'
    const gp = cfg.googlePay
    const merchantId = isProd ? gp.productionMerchantId || gp.merchantId : gp.merchantId
    const merchantName = isProd ? gp.productionMerchantName || gp.merchantName : gp.merchantName
    const gateway = isProd ? gp.productionGateway || gp.gateway : gp.gateway
    const gatewayMerchantId = isProd
      ? gp.productionGatewayMerchantId || gp.gatewayMerchantId
      : gp.gatewayMerchantId
    const cardParameters = {
      allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
      allowedCardNetworks: ['MASTERCARD', 'VISA']
    }
    if (options.billingAddress) {
      cardParameters.billingAddressRequired = true
      cardParameters.billingAddressParameters = {
        format: 'FULL',
        phoneNumberRequired: false
      }
    }
    return {
      apiVersion: 2,
      apiVersionMinor: 0,
      allowedPaymentMethods: [
        {
          type: 'CARD',
          parameters: cardParameters,
          tokenizationSpecification: {
            type: 'PAYMENT_GATEWAY',
            parameters: {
              gateway: gateway,
              gatewayMerchantId: gatewayMerchantId
            }
          }
        }
      ],
      transactionInfo: {
        countryCode: countryCode,
        currencyCode: currency,
        totalPriceStatus: 'FINAL',
        totalPrice: amount,
        totalPriceLabel: 'Total'
      },
      merchantInfo: {
        merchantId: merchantId,
        merchantName: merchantName
      },
      callbackIntents: ['PAYMENT_AUTHORIZATION']
    }
  }

  function appleParams(request) {
    const amount = (request && request.amount) || cfg.payment.amount
    const currency = (request && (request.fiatCurrency || request.currency)) || cfg.payment.currency
    const countryCode =
      (request && (request.alpha2 || request.countryCode)) || cfg.payment.countryCode
    const params = {
      countryCode: countryCode,
      currencyCode: currency,
      merchantCapabilities: ['supports3DS', 'supportsCredit', 'supportsDebit'],
      supportedNetworks: ['masterCard', 'visa'],
      total: {
        label: 'ALCHEMY GPS EUROPE UAB',
        type: 'final',
        amount: amount
      }
    }
    if (options.billingAddress) {
      params.requiredBillingContactFields = ['name', 'postalAddress', 'phone', 'email']
    }
    return params
  }

  function buildCreateOrderData(request, orderNo) {
    const environment = options.environment === 'PRODUCTION' ? 'PRODUCTION' : 'TEST'
    const no = orderNo || 'ord_preview'
    /** @type {Record<string, unknown>} */
    const data = {
      orderNo: no,
      environment: environment,
      method: options.method === 'applePay' ? 'applePay' : 'googlePay',
      token: 'demo-payment-hub-token-' + no,
      risk: buildRisk()
    }

    if (data.method === 'applePay') {
      data.paymentScript = appleParams(request)
      if (!options.omitValidateUrl) {
        data.validateMerchantUrl =
          environment === 'TEST'
            ? 'https://api-test.alchemytech.cc/pay/apple/domainName/verify'
            : 'https://api.alchemypay.org/pay/apple/domainName/verify'
      }
    } else {
      data.paymentScript = googleParams(request)
    }
    return data
  }

  function createOrder(request) {
    const orderNo = 'ord_demo_' + Date.now().toString(36)
    const data = buildCreateOrderData(request, orderNo)
    orders[orderNo] = { ticks: 0, options: { ...options } }
    return envelope(data)
  }

  /** Demo helper: build + register create-order data for PaySdk.init({ order }) */
  function takeCreateOrder(request) {
    const orderNo = 'ord_demo_' + Date.now().toString(36)
    const data = buildCreateOrderData(request, orderNo)
    orders[orderNo] = { ticks: 0, options: { ...options } }
    return data
  }

  function validateMerchant() {
    const now = Date.now()
    return envelope({
      epochTimestamp: now,
      expiresAt: now + 300000,
      merchantSessionIdentifier: 'demo-merchant-session',
      nonce: 'demo-nonce',
      merchantIdentifier: 'merchant.demo',
      domainName: location.hostname,
      displayName: 'Demo Merchant',
      signature: 'demo-signature',
      operationalAnalyticsIdentifier: 'Demo Merchant:merchant.demo',
      retries: 0,
      pspId: 'merchant.demo'
    })
  }

  function pay(request) {
    const orderNo = request && (request.orderNo || request.orderId)
    const state = orderNo ? orders[orderNo] : null
    const outcome = (state && state.options.payOutcome) || options.payOutcome

    // Wire: customParam.encryptedData（兼容旧扁平 body 便于本地调试）
    const encrypted =
      (request && request.customParam && request.customParam.encryptedData) ||
      (request && request.encryptedData)
    if (!encrypted) {
      return {
        success: false,
        returnCode: '1002',
        returnMsg: 'missing customParam.encryptedData',
        extend: '',
        data: {},
        traceId: 'demo-mock-trace'
      }
    }

    if (outcome === 'webUrl') {
      return envelope({ webUrl: 'https://psp.example/checkout/' + (orderNo || 'xxx') })
    }
    if (outcome === 'threeDS') {
      return envelope({
        MD: 'demo-md',
        JWT: 'demo-jwt',
        action: 'https://acs.example/challenge'
      })
    }
    if (outcome === 'threeDSMethod') {
      return envelope({
        threeDSMethodData: 'demo-method-data',
        methodUrl: 'https://psp.example/3ds-method'
      })
    }
    return envelope({})
  }

  function queryOrder(orderNo) {
    const state = orders[orderNo] || { ticks: 0, options: { ...options } }
    state.ticks += 1
    orders[orderNo] = state
    const outcome = state.options.payOutcome || 'success'

    if (outcome === 'success') {
      return envelope({
        orderNo: orderNo,
        orderState: 2,
        s3dsComplete: true
      })
    }

    if (state.ticks === 2 && outcome === 'webUrl') {
      return envelope({
        orderNo: orderNo,
        orderState: 1,
        s3dsUrl: 'https://acs.example/s3ds/' + orderNo,
        s3dsComplete: false
      })
    }

    if (state.ticks >= 3) {
      return envelope({
        orderNo: orderNo,
        orderState: 2,
        s3dsComplete: true
      })
    }

    return envelope({
      orderNo: orderNo,
      orderState: 1,
      s3dsComplete: false
    })
  }

  function pathOf(input) {
    if (typeof input === 'string') {
      try {
        return new URL(input, location.origin).pathname
      } catch {
        return input
      }
    }
    if (input && typeof input.url === 'string') {
      try {
        return new URL(input.url, location.origin).pathname
      } catch {
        return input.url
      }
    }
    return ''
  }

  function searchOf(input) {
    const raw =
      typeof input === 'string' ? input : input && typeof input.url === 'string' ? input.url : ''
    try {
      return new URL(raw, location.origin).searchParams
    } catch {
      return new URLSearchParams()
    }
  }

  async function parseBody(init) {
    if (!init || init.body == null) return undefined
    if (typeof init.body === 'string') {
      try {
        return JSON.parse(init.body)
      } catch {
        return undefined
      }
    }
    return undefined
  }

  async function mockFetch(input, init) {
    const path = pathOf(input)
    const method = ((init && init.method) || 'GET').toUpperCase()
    const body = await parseBody(init)

    await new Promise(function (r) {
      setTimeout(r, 120)
    })

    if (method === 'POST' && /\/v1\/pay\/orders\/?$/.test(path)) {
      return jsonResponse(createOrder(body))
    }
    if (method === 'POST' && /\/v1\/pay\/payments\/?$/.test(path)) {
      return jsonResponse(pay(body))
    }
    if (method === 'GET' && /\/v1\/pay\/orders/.test(path)) {
      const orderNo =
        searchOf(input).get('orderNo') || decodeURIComponent(path.split('/').pop() || '')
      return jsonResponse(queryOrder(orderNo))
    }
    if (method === 'POST' && /apple|domainName|validate|domain\/verify/i.test(path)) {
      return jsonResponse(validateMerchant())
    }

    return jsonResponse(
      {
        success: false,
        returnCode: '4040',
        returnMsg: 'Mock API: unmatched path ' + method + ' ' + path,
        extend: '',
        data: {},
        traceId: 'demo-mock-miss'
      },
      404
    )
  }

  global.PaySdkDemoMock = {
    getOptions() {
      return { ...options }
    },
    setOptions(next) {
      options = { ...options, ...next }
      return this.getOptions()
    },
    previewCreateOrder(request) {
      return buildCreateOrderData(request || cfg.payment, 'ord_preview')
    },
    takeCreateOrder: takeCreateOrder,
    fetch: mockFetch
  }
})(window)
