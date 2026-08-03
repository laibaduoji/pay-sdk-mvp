/**
 * Managed-flow demo mock for /v1/pay/* (and Apple validate path).
 * Driven by checkbox options; plug in via api.fetch.
 *
 * payOutcome webUrl / threeDS / threeDSMethod 使用联调抓包沙箱 fixture（JWT/token 可能过期）。
 */
;(function (global) {
  const SUCCESS = {
    success: true,
    returnCode: '0000',
    returnMsg: 'SUCCESS',
    extend: '',
    traceId: 'demo-mock-trace'
  }

  /** 真实沙箱支付响应快照（仅 data；traceId 见各 fixture） */
  const PAY_FIXTURES = {
    webUrl: {
      traceId: '6a703f701c5cd2cc4848425de62eea9d',
      data: {
        tradeNo: '100217857411690961095',
        webUrl:
          'https://sandbox.cardpay.com/MI/payments/redirect?token=039ebe84-8663-446b-a12d-427545582f43'
      }
    },
    threeDS: {
      traceId: '6a0416ec45381f7646d9343f1d6c53db',
      data: {
        amount: '200',
        tradeNo: '100217786529097410406',
        month: '12',
        year: '2030',
        JWT: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI4ZmQ4Y2MxMy1iMzBlLTQ3YmYtYmNiNC1lM2I3NDBkYzU4MDYiLCJpYXQiOjE3Nzg2NTI5MTMsImlzcyI6IjY0NjFmZDU3ZDQ1M2E3NGRkMjJlNzIxMCIsIlJldHVyblVybCI6Imh0dHBzOi8vZmlhdGFwaS1zYnguYWxjaGVteXBheS5vcmcvY2FsbGJhY2svd29ybGRQYXkvdGhyZWVkcyIsIk9iamVjdGlmeVBheWxvYWQiOnRydWUsIlBheWxvYWQiOiJ7XCJQYXlsb2FkXCI6XCJleUp0WlhOellXZGxWSGx3WlNJNklrTlNaWEVpTENKdFpYTnpZV2RsVm1WeWMybHZiaUk2SWpJdU1pNHdJaXdpZEdoeVpXVkVVMU5sY25abGNsUnlZVzV6U1VRaU9pSTJNekUxWXpVek1pMWtOVEJqTFRSa05HVXRZV1E1TlMxaU9UWXpORGM1TkRBM09UQWlMQ0poWTNOVWNtRnVjMGxFSWpvaU5XTTJaVFUwTXpZdFlqSTROUzAwWXpneUxXRTNZV1F0TWpWaVlXTTVOVFV3TmpRMUlpd2lZMmhoYkd4bGJtZGxWMmx1Wkc5M1UybDZaU0k2SWpBeUluMFwiLFwiQUNTVXJsXCI6XCJodHRwczovL2F1dGhlbnRpY2F0aW9uLmNhcmRpbmFsY29tbWVyY2UuY29tL1RocmVlRFNlY3VyZS9WMl8xXzAvQ1JlcT9vaWQ9NjBkMGM3M2QyYmMwMDE3NDJkMTdiOTc0JnRpZD01YzZlNTQzNi1iMjg1LTRjODItYTdhZC0yNWJhYzk1NTA2NDVcIixcIlRyYW5zYWN0aW9uSWRcIjpcInFrYVZJVFJpdUtUM09DYXlCVDUxXCJ9IiwiZXhwIjoxNzc4NjYwMTEzLCJPcmdVbml0SWQiOiI2NDYxZmQ1N2Q0NTNhNzRkZDIyZTcyMGYifQ.j9i6nnmDrnuKNyuXj4i84WnK5yZyJHoCfreQZEzSTv0',
        MD: '100317786529101530377',
        tokenNumber: '4179710559796835',
        action: 'https://centinelapi.cardinalcommerce.com/V2/Cruise/StepUp',
        version: '2.2.0',
        exponent: '2'
      }
    },
    threeDSMethod: {
      traceId: '6a5f0db51c1586d67446cb33bf5a34d6',
      data: {
        methodUrl:
          'https://methodurl.vcas.visa.com/DeviceFingerprintWeb/V2/Browser/RenderMethodURL?id=60d0c73d2bc001742d17b974',
        threeDSMethodData:
          'eyJ0aHJlZURTTWV0aG9kTm90aWZpY2F0aW9uVVJMIjoiaHR0cHM6Ly9maWF0YXBpLXNieC5hbGNoZW15cGF5Lm9yZy9jYWxsYmFjay9zaGlmdC9maW5nZXJwcmludC8xMDAzMTc4NDYxNDMyNjY4MDA4NzMiLCJ0aHJlZURTU2VydmVyVHJhbnNJRCI6IjYwOWNmNDI5LTY0ZDMtNGUxOS05NjcyLTIzMWNmM2E1MDhmNyJ9',
        orderNo: 'XZZ515971485e762297QBATU3UNTRGGT',
        tradeNo: '100217846143265270919',
        threeDSServerTransID: '609cf429-64d3-4e19-9672-231cf3a508f7'
      }
    }
  }

  const cfg = global.PaySdkDemoConfig || {
    payment: { amount: '1', currency: 'USD', countryCode: 'US' },
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

  function envelope(data, traceId) {
    return {
      ...SUCCESS,
      traceId: traceId || SUCCESS.traceId,
      data
    }
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
    // 与真实 create-order 一致：不在 paymentScript 里预置 callbackIntents（由 SDK 固定补齐）
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
      }
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

    if (outcome === 'webUrl' || outcome === 'threeDS' || outcome === 'threeDSMethod') {
      const fixture = PAY_FIXTURES[outcome]
      return envelope({ ...fixture.data }, fixture.traceId)
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

    // webUrl / threeDS / threeDSMethod：不注入假 s3dsUrl，数 tick 后终态以便 closePayWebUrl
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
