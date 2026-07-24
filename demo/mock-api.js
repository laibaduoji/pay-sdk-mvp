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
    const currency = (request && request.currency) || cfg.payment.currency
    const countryCode = (request && request.countryCode) || cfg.payment.countryCode
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
    const currency = (request && request.currency) || cfg.payment.currency
    const countryCode = (request && request.countryCode) || cfg.payment.countryCode
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

  function buildCreateOrderData(request, orderId) {
    const environment = options.environment === 'PRODUCTION' ? 'PRODUCTION' : 'TEST'
    /** @type {Record<string, unknown>} */
    const data = {
      orderId: orderId || 'ord_preview',
      environment: environment,
      method: options.method === 'applePay' ? 'applePay' : 'googlePay',
      risk: buildRisk()
    }

    if (data.method === 'applePay') {
      data.params = appleParams(request)
      if (!options.omitValidateUrl) {
        data.validateMerchantUrl =
          environment === 'TEST'
            ? 'https://api-test.alchemytech.cc/pay/apple/domainName/verify'
            : 'https://api.alchemypay.org/pay/apple/domainName/verify'
      }
    } else {
      data.params = googleParams(request)
    }
    return data
  }

  function createOrder(request) {
    const orderId = 'ord_demo_' + Date.now().toString(36)
    const data = buildCreateOrderData(request, orderId)
    orders[orderId] = { ticks: 0, options: { ...options } }
    return envelope(data)
  }

  function validateMerchant() {
    return envelope({
      epochTimestamp: Date.now(),
      expiresAt: Date.now() + 300000,
      merchantSessionIdentifier: 'demo-merchant-session',
      nonce: 'demo-nonce',
      merchantIdentifier: 'merchant.demo',
      domainName: location.hostname,
      displayName: 'Demo Merchant',
      signature: 'demo-signature'
    })
  }

  function pay(request) {
    const orderId = request && request.orderId
    const state = orderId ? orders[orderId] : null
    const outcome = (state && state.options.payOutcome) || options.payOutcome

    if (outcome === 'webUrl') {
      return envelope({ webUrl: 'https://psp.example/checkout/' + (orderId || 'xxx') })
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

  function queryOrder(orderId) {
    const state = orders[orderId] || { ticks: 0, options: { ...options } }
    state.ticks += 1
    orders[orderId] = state
    const outcome = state.options.payOutcome || 'success'

    if (outcome === 'success') {
      return envelope({
        orderId: orderId,
        status: 'succeeded',
        s3dsComplete: true
      })
    }

    if (state.ticks === 2 && outcome === 'webUrl') {
      return envelope({
        orderId: orderId,
        status: 'requires_action',
        s3dsUrl: 'https://acs.example/s3ds/' + orderId,
        s3dsComplete: false
      })
    }

    if (state.ticks >= 3) {
      return envelope({
        orderId: orderId,
        status: 'succeeded',
        s3dsComplete: true
      })
    }

    return envelope({
      orderId: orderId,
      status: 'requires_action',
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
    if (method === 'GET' && /\/v1\/pay\/orders\//.test(path)) {
      const orderId = decodeURIComponent(path.split('/').pop() || '')
      return jsonResponse(queryOrder(orderId))
    }
    if (method === 'POST' && /apple|domainName|validate/i.test(path)) {
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
    fetch: mockFetch
  }
})(window)
