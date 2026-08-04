/**
 * Demo multi-page session (create → confirm → result).
 */
;(function (global) {
  var KEY_FLOW = 'paySdkDemo.flow'
  var KEY_RESULT = 'paySdkDemo.result'
  var KEY_APP_ID = 'paySdkDemo.appId'
  var KEY_APP_SECRET = 'paySdkDemo.appSecret'
  var KEY_ACCESS_TOKEN = 'paySdkDemo.accessToken'
  var KEY_EMAIL = 'paySdkDemo.email'
  var KEY_UID = 'paySdkDemo.uid'

  /** Align H5 / SDK ON_RAMP_ORDER_STATUS_MAP */
  var ORDER_STATE_LABEL = {
    0: 'PAY_FAIL',
    1: 'PENDING',
    2: 'PAY_SUCCESS',
    3: 'TRANSFER',
    4: 'TRANSFER',
    5: 'FINISHED',
    6: 'CANCEL',
    7: 'PAY_FAIL',
    8: 'RISK_CONTROL',
    9: 'REFUNDED',
    10: 'REFUNDED',
    11: 'PAY_FAIL'
  }

  function safeParse(raw) {
    if (!raw) return null
    try {
      return JSON.parse(raw)
    } catch (_) {
      return null
    }
  }

  function readJson(key) {
    try {
      return safeParse(sessionStorage.getItem(key))
    } catch (_) {
      return null
    }
  }

  function writeJson(key, value) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value))
      return true
    } catch (_) {
      return false
    }
  }

  function removeKey(key) {
    try {
      sessionStorage.removeItem(key)
    } catch (_) {}
  }

  function getFlow() {
    return readJson(KEY_FLOW)
  }

  function setFlow(flow) {
    return writeJson(KEY_FLOW, flow)
  }

  function clearFlow() {
    removeKey(KEY_FLOW)
  }

  function getResult() {
    return readJson(KEY_RESULT)
  }

  function setResult(result) {
    return writeJson(KEY_RESULT, result)
  }

  function clearResult() {
    removeKey(KEY_RESULT)
  }

  /** Clear flow + result; keep API credentials. */
  function clearOrderSession() {
    clearFlow()
    clearResult()
  }

  function orderStateLabel(orderState) {
    if (orderState == null || orderState === '') return '—'
    var n = Number(orderState)
    if (!Number.isFinite(n)) return String(orderState)
    return ORDER_STATE_LABEL[n] || 'UNKNOWN_' + n
  }

  function formatFiat(detail) {
    if (!detail) return '—'
    var amount = detail.fiatCurrencyAmount
    var currency = detail.fiatCurrency || ''
    if (amount == null || amount === '') return currency || '—'
    return String(amount) + (currency ? ' ' + currency : '')
  }

  function formatCrypto(detail) {
    if (!detail) return '—'
    var qty = detail.cryptoCurrencyQuantity
    var unit = detail.cryptoCurrency || ''
    if (qty == null || qty === '') return unit || '—'
    return String(qty) + (unit ? ' ' + unit : '')
  }

  /**
   * Render order summary rows into a container element.
   * @param {HTMLElement|null} el
   * @param {{ detail?: object, orderRequest?: object }} opts
   */
  function renderOrderSummary(el, opts) {
    if (!el) return
    var detail = (opts && opts.detail) || {}
    var orderRequest = (opts && opts.orderRequest) || {}
    var state = detail.orderState
    var stateText =
      state != null && state !== '' ? String(state) + ' · ' + orderStateLabel(state) : '—'
    var payWay = detail.payWayCode || '—'
    if (detail.channelCode) payWay = payWay + ' / ' + detail.channelCode

    var rows = [
      ['订单号', detail.orderNo || '—'],
      ['商户订单号', detail.merchantOrderNo || '—'],
      ['订单状态', stateText],
      ['法币金额', formatFiat(detail)],
      ['Crypto 数量', formatCrypto(detail)],
      ['支付方式', payWay],
      ['国家', detail.alpha2 || '—'],
      ['网络', orderRequest.network || '—'],
      ['收款地址', orderRequest.address || '—']
    ]

    var html = '<dl class="order-summary">'
    for (var i = 0; i < rows.length; i++) {
      html +=
        '<div class="order-summary-row"><dt>' +
        escapeHtml(rows[i][0]) +
        '</dt><dd>' +
        escapeHtml(String(rows[i][1])) +
        '</dd></div>'
    }
    html += '</dl>'
    el.innerHTML = html
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }

  function persistCreds(creds) {
    try {
      if (creds.appId != null) sessionStorage.setItem(KEY_APP_ID, creds.appId)
      if (creds.appSecret != null) sessionStorage.setItem(KEY_APP_SECRET, creds.appSecret)
    } catch (_) {}
  }

  function persistIdentity(identity) {
    try {
      sessionStorage.setItem(KEY_ACCESS_TOKEN, (identity && identity.accessToken) || '')
      sessionStorage.setItem(KEY_EMAIL, (identity && identity.email) || '')
      sessionStorage.setItem(KEY_UID, (identity && identity.uid) || '')
    } catch (_) {}
  }

  function readSavedCreds() {
    try {
      return {
        appId: sessionStorage.getItem(KEY_APP_ID) || '',
        appSecret: sessionStorage.getItem(KEY_APP_SECRET) || ''
      }
    } catch (_) {
      return { appId: '', appSecret: '' }
    }
  }

  function readSavedIdentity() {
    try {
      return {
        accessToken: sessionStorage.getItem(KEY_ACCESS_TOKEN) || '',
        email: sessionStorage.getItem(KEY_EMAIL) || '',
        uid: sessionStorage.getItem(KEY_UID) || ''
      }
    } catch (_) {
      return { accessToken: '', email: '', uid: '' }
    }
  }

  global.PaySdkDemoSession = {
    KEY_FLOW: KEY_FLOW,
    KEY_RESULT: KEY_RESULT,
    getFlow: getFlow,
    setFlow: setFlow,
    clearFlow: clearFlow,
    getResult: getResult,
    setResult: setResult,
    clearResult: clearResult,
    clearOrderSession: clearOrderSession,
    orderStateLabel: orderStateLabel,
    formatFiat: formatFiat,
    formatCrypto: formatCrypto,
    renderOrderSummary: renderOrderSummary,
    persistCreds: persistCreds,
    persistIdentity: persistIdentity,
    readSavedCreds: readSavedCreds,
    readSavedIdentity: readSavedIdentity
  }
})(window)
