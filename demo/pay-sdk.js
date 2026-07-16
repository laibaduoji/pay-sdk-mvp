var PaySdk = (function (exports) {
  'use strict'
  const GOOGLE_PAY_JS = 'https://pay.google.com/gp/p/js/pay.js'
  const APPLE_PAY_JS = 'https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js'
  const cache = {}
  function loadScript(src, { crossorigin = false } = {}) {
    const cached = cache[src]
    if (cached) return cached
    const promise = new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${src}"]`)
      if (existing) {
        if (existing.dataset.loaded === 'true') return resolve()
        existing.addEventListener('load', () => resolve())
        existing.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)))
        return
      }
      const script = document.createElement('script')
      script.src = src
      script.async = true
      if (crossorigin) script.crossOrigin = 'anonymous'
      script.addEventListener('load', () => {
        script.dataset.loaded = 'true'
        resolve()
      })
      script.addEventListener('error', () => reject(new Error(`Failed to load ${src}`)))
      document.head.appendChild(script)
    })
    cache[src] = promise
    return promise
  }
  function loadGooglePay() {
    var _a, _b
    if ((_b = (_a = window.google) == null ? void 0 : _a.payments) == null ? void 0 : _b.api)
      return Promise.resolve()
    return loadScript(GOOGLE_PAY_JS)
  }
  function loadApplePay() {
    return loadScript(APPLE_PAY_JS, { crossorigin: true }).catch(() => {})
  }
  function normalizeGoogleResult(paymentData) {
    var _a, _b, _c
    const tokenizationData =
      (_a = paymentData == null ? void 0 : paymentData.paymentMethodData) == null
        ? void 0
        : _a.tokenizationData
    return {
      method: 'googlePay',
      token: tokenizationData == null ? void 0 : tokenizationData.token,
      paymentMethodData: paymentData == null ? void 0 : paymentData.paymentMethodData,
      billingAddress:
        (_c =
          (_b = paymentData == null ? void 0 : paymentData.paymentMethodData) == null
            ? void 0
            : _b.info) == null
          ? void 0
          : _c.billingAddress,
      email: paymentData == null ? void 0 : paymentData.email,
      raw: paymentData
    }
  }
  function normalizeAppleResult(payment) {
    return {
      method: 'applePay',
      token: payment == null ? void 0 : payment.token,
      billingContact: payment == null ? void 0 : payment.billingContact,
      shippingContact: payment == null ? void 0 : payment.shippingContact,
      raw: payment
    }
  }
  function isGoogleCancel(err) {
    return (err == null ? void 0 : err.statusCode) === 'CANCELED'
  }
  function toError(err) {
    if (err instanceof Error) return err
    if (typeof err === 'string') return new Error(err)
    try {
      return new Error(JSON.stringify(err))
    } catch {
      return new Error('Unknown error')
    }
  }
  let paymentsClient = null
  function merchantInfo(config) {
    const gp = config.googlePay
    const info = {
      merchantName: (gp == null ? void 0 : gp.merchantName) || 'Merchant'
    }
    if (gp == null ? void 0 : gp.merchantId) info.merchantId = gp.merchantId
    return info
  }
  function getPaymentsClient(config) {
    if (paymentsClient) return paymentsClient
    paymentsClient = new google.payments.api.PaymentsClient({
      environment: config.environment === 'PRODUCTION' ? 'PRODUCTION' : 'TEST',
      merchantInfo: merchantInfo(config)
    })
    return paymentsClient
  }
  function buildCardPaymentMethod(config) {
    const gp = config.googlePay
    const parameters = {
      allowedAuthMethods: (gp == null ? void 0 : gp.allowedAuthMethods) || [
        'PAN_ONLY',
        'CRYPTOGRAM_3DS'
      ],
      allowedCardNetworks: (gp == null ? void 0 : gp.allowedCardNetworks) || ['MASTERCARD', 'VISA']
    }
    if (config.billingAddressRequired) {
      parameters.billingAddressRequired = true
      parameters.billingAddressParameters = {
        format: 'FULL',
        phoneNumberRequired: false
      }
    }
    return {
      type: 'CARD',
      parameters,
      tokenizationSpecification: gp.tokenizationSpecification
    }
  }
  function buildGoogleBaseRequest(config) {
    return {
      apiVersion: 2,
      apiVersionMinor: 0,
      allowedPaymentMethods: [buildCardPaymentMethod(config)]
    }
  }
  function buildPaymentDataRequest(config) {
    const payment = config.payment
    return {
      apiVersion: 2,
      apiVersionMinor: 0,
      allowedPaymentMethods: [buildCardPaymentMethod(config)],
      merchantInfo: merchantInfo(config),
      transactionInfo: {
        countryCode: payment.countryCode,
        currencyCode: payment.currency,
        totalPriceStatus: 'FINAL',
        totalPrice: String(payment.amount),
        totalPriceLabel: 'Total'
      }
    }
  }
  function buttonOptions(config, onClick) {
    var _a
    const btn = ((_a = config.googlePay) == null ? void 0 : _a.button) || {}
    const options = {
      onClick,
      buttonColor: btn.buttonColor || 'default',
      buttonType: btn.buttonType || 'plain',
      buttonSizeMode: btn.buttonSizeMode || 'fill'
    }
    if (btn.buttonLocale) options.buttonLocale = btn.buttonLocale
    return options
  }
  function createGoogleButton(config, onClick) {
    return getPaymentsClient(config).createButton(buttonOptions(config, onClick))
  }
  async function payWithGoogle(config) {
    var _a, _b, _c
    const client = getPaymentsClient(config)
    try {
      const paymentData = await client.loadPaymentData(buildPaymentDataRequest(config))
      ;(_a = config.onSuccess) == null
        ? void 0
        : _a.call(config, normalizeGoogleResult(paymentData))
    } catch (err) {
      if (isGoogleCancel(err)) {
        ;(_b = config.onCancel) == null ? void 0 : _b.call(config)
        return
      }
      ;(_c = config.onError) == null ? void 0 : _c.call(config, toError(err))
    }
  }
  async function readyGooglePay(config) {
    var _a, _b
    await loadGooglePay()
    if (!((_b = (_a = window.google) == null ? void 0 : _a.payments) == null ? void 0 : _b.api)) {
      throw new Error('Google Pay JS failed to load')
    }
    const client = getPaymentsClient(config)
    const res = await client.isReadyToPay(buildGoogleBaseRequest(config))
    if (!(res == null ? void 0 : res.result)) {
      throw new Error('Google Pay is not available for this user/environment')
    }
    return true
  }
  async function readyApplePay() {
    await loadApplePay()
    if (typeof ApplePaySession === 'undefined') {
      throw new Error('Apple Pay is not supported in this browser')
    }
    if (!ApplePaySession.canMakePayments()) {
      throw new Error('Apple Pay cannot make payments on this device')
    }
    return true
  }
  function ready(config) {
    if (config.method === 'googlePay') return readyGooglePay(config)
    if (config.method === 'applePay') return readyApplePay()
    return Promise.reject(new Error(`Unknown payment method: ${config.method}`))
  }
  const APPLE_BUTTON_STYLE_ID = 'pay-sdk-apple-button-style'
  function resolveContainer(container) {
    const el = typeof container === 'string' ? document.querySelector(container) : container
    if (!el) throw new Error(`Pay SDK container not found: ${String(container)}`)
    return el
  }
  function injectAppleButtonStyle() {
    if (document.getElementById(APPLE_BUTTON_STYLE_ID)) return
    const style = document.createElement('style')
    style.id = APPLE_BUTTON_STYLE_ID
    style.textContent = `
apple-pay-button {
  --apple-pay-button-width: 100%;
  --apple-pay-button-height: 40px;
  --apple-pay-button-border-radius: 4px;
  --apple-pay-button-padding: 0px 0px;
  --apple-pay-button-box-sizing: border-box;
}`
    document.head.appendChild(style)
  }
  function renderAppleButton(el, config, onClick) {
    var _a
    injectAppleButtonStyle()
    const btn = ((_a = config.applePay) == null ? void 0 : _a.button) || {}
    const button = document.createElement('apple-pay-button')
    button.setAttribute('buttonstyle', btn.buttonstyle || 'black')
    button.setAttribute('type', btn.type || 'plain')
    button.setAttribute('locale', btn.locale || 'en-US')
    button.addEventListener('click', onClick)
    el.appendChild(button)
    return button
  }
  function renderGoogleButton(el, config, onClick) {
    const button = createGoogleButton(config, onClick)
    el.appendChild(button)
    return button
  }
  function renderButton(config, onClick) {
    const el = resolveContainer(config.container)
    el.innerHTML = ''
    if (config.method === 'googlePay') return renderGoogleButton(el, config, onClick)
    if (config.method === 'applePay') return renderAppleButton(el, config, onClick)
    throw new Error(`Unknown payment method: ${config.method}`)
  }
  const APPLE_PAY_VERSION = 3
  const DEFAULT_CAPABILITIES = ['supports3DS', 'supportsCredit', 'supportsDebit']
  const DEFAULT_NETWORKS = ['masterCard', 'visa']
  const BILLING_CONTACT_FIELDS = ['name', 'postalAddress', 'phone', 'email']
  function buildPaymentRequest(config) {
    const payment = config.payment
    const ap = config.applePay
    const request = {
      countryCode: payment.countryCode,
      currencyCode: payment.currency,
      merchantCapabilities: (ap == null ? void 0 : ap.merchantCapabilities) || DEFAULT_CAPABILITIES,
      supportedNetworks: (ap == null ? void 0 : ap.supportedNetworks) || DEFAULT_NETWORKS,
      total: {
        label: 'ALCHEMY GPS EUROPE UAB',
        type: 'final',
        amount: String(payment.amount)
      }
    }
    if (config.billingAddressRequired) {
      request.requiredBillingContactFields = BILLING_CONTACT_FIELDS
    }
    return request
  }
  async function fetchMerchantSession(config, validationURL) {
    const ap = config.applePay
    const res = await fetch(ap.validateMerchantUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ validationURL })
    })
    if (!res.ok) {
      throw new Error(`Merchant validation failed with status ${res.status}`)
    }
    return res.json()
  }
  function payWithApple(config) {
    var _a
    const ap = config.applePay
    if (!(ap == null ? void 0 : ap.validateMerchantUrl)) {
      ;(_a = config.onError) == null
        ? void 0
        : _a.call(config, new Error('applePay.validateMerchantUrl is required'))
      return
    }
    const session = new ApplePaySession(APPLE_PAY_VERSION, buildPaymentRequest(config))
    session.onvalidatemerchant = async (event) => {
      var _a2
      try {
        const merchantSession = await fetchMerchantSession(config, event.validationURL)
        session.completeMerchantValidation(merchantSession)
      } catch (err) {
        session.abort()
        ;(_a2 = config.onError) == null ? void 0 : _a2.call(config, toError(err))
      }
    }
    session.onpaymentauthorized = (event) => {
      var _a2
      session.completePayment(ApplePaySession.STATUS_SUCCESS)
      ;(_a2 = config.onSuccess) == null
        ? void 0
        : _a2.call(config, normalizeAppleResult(event.payment))
    }
    session.oncancel = () => {
      var _a2
      ;(_a2 = config.onCancel) == null ? void 0 : _a2.call(config)
    }
    session.begin()
  }
  const SUPPORTED_METHODS = ['googlePay', 'applePay']
  function validateConfig(config) {
    var _a, _b
    if (!config || typeof config !== 'object') {
      throw new Error('PaySdk.init requires a config object')
    }
    if (!SUPPORTED_METHODS.includes(config.method)) {
      throw new Error(`config.method must be one of: ${SUPPORTED_METHODS.join(', ')}`)
    }
    if (!config.container) {
      throw new Error('config.container is required')
    }
    if (!config.payment || config.payment.amount == null || !config.payment.currency) {
      throw new Error('config.payment.amount and config.payment.currency are required')
    }
    if (
      config.method === 'googlePay' &&
      !((_a = config.googlePay) == null ? void 0 : _a.tokenizationSpecification)
    ) {
      throw new Error('googlePay.tokenizationSpecification is required')
    }
    if (
      config.method === 'applePay' &&
      !((_b = config.applePay) == null ? void 0 : _b.validateMerchantUrl)
    ) {
      throw new Error('applePay.validateMerchantUrl is required')
    }
  }
  class PaySdkInstance {
    constructor(config) {
      this._readyPromise = null
      this._button = null
      this.config = config
    }
    // Resolves once the wallet JS is loaded and the environment supports payment.
    ready() {
      if (!this._readyPromise) {
        this._readyPromise = ready(this.config)
      }
      return this._readyPromise
    }
    _pay() {
      if (this.config.method === 'googlePay') {
        void payWithGoogle(this.config)
        return
      }
      payWithApple(this.config)
    }
    // Renders the official button into the container and wires up the click.
    mount() {
      this._button = renderButton(this.config, () => this._pay())
      return this
    }
    destroy() {
      var _a
      ;(_a = this._button) == null ? void 0 : _a.remove()
      this._button = null
      const el = resolveContainer(this.config.container)
      if (el) el.innerHTML = ''
    }
  }
  function init(config) {
    validateConfig(config)
    return new PaySdkInstance(config)
  }
  exports.init = init
  Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' })
  return exports
})({})
