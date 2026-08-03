/**
 * Demo-only AlchemyPay API Sign + signed fetch.
 * Port of https://alchemypay.readme.io/docs/api-sign.
 * Not used by the SDK runtime.
 */
;(function (global) {
  function bytesToBase64(bytes) {
    const view = new Uint8Array(bytes)
    let binary = ''
    for (let i = 0; i < view.length; i++) {
      binary += String.fromCharCode(view[i])
    }
    return btoa(binary)
  }

  async function hmacSha256Base64(content, secretkey) {
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secretkey),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const signature = await crypto.subtle.sign('HMAC', key, enc.encode(content))
    return bytesToBase64(signature)
  }

  function getPath(requestUrl) {
    const uri = new URL(requestUrl)
    const path = uri.pathname
    const params = Array.from(uri.searchParams.entries())
    if (params.length === 0) return path
    const sortedParams = params.slice().sort(function (a, b) {
      return a[0].localeCompare(b[0])
    })
    const queryString = sortedParams
      .map(function (pair) {
        return pair[0] + '=' + pair[1]
      })
      .join('&')
    return path + '?' + queryString
  }

  function removeEmptyKeys(map) {
    const retMap = {}
    for (const key of Object.keys(map)) {
      const value = map[key]
      if (value !== null && value !== '') retMap[key] = value
    }
    return retMap
  }

  function sortList(list) {
    const objectList = []
    const intList = []
    const floatList = []
    const stringList = []
    const jsonArray = []

    for (let i = 0; i < list.length; i++) {
      const item = list[i]
      if (typeof item === 'object' && item !== null) jsonArray.push(item)
      else if (typeof item === 'number' && Number.isInteger(item)) intList.push(item)
      else if (typeof item === 'number') floatList.push(item)
      else if (typeof item === 'string') stringList.push(item)
      else intList.push(item)
    }

    intList.sort(function (a, b) {
      return a - b
    })
    floatList.sort(function (a, b) {
      return a - b
    })
    stringList.sort()
    objectList.push.apply(objectList, intList.concat(floatList, stringList, jsonArray))
    list.length = 0
    for (let i = 0; i < objectList.length; i++) list.push(objectList[i])

    const retList = []
    for (let i = 0; i < list.length; i++) {
      const item = list[i]
      if (typeof item === 'object' && item !== null) retList.push(sortObject(item))
      else retList.push(item)
    }
    return retList
  }

  function sortMap(map) {
    const entries = Object.entries(removeEmptyKeys(map)).sort(function (a, b) {
      return a[0].localeCompare(b[0])
    })
    const sorted = {}
    for (let i = 0; i < entries.length; i++) {
      const key = entries[i][0]
      let value = entries[i][1]
      if (typeof value === 'object' && value !== null) value = sortObject(value)
      sorted[key] = value
    }
    return sorted
  }

  function sortObject(obj) {
    if (typeof obj === 'object' && obj !== null) {
      if (Array.isArray(obj)) return sortList(obj)
      return sortMap(obj)
    }
    return obj
  }

  function getJsonBody(body) {
    let map
    try {
      map = JSON.parse(body)
    } catch (_) {
      map = {}
    }
    if (!map || typeof map !== 'object' || Array.isArray(map) || Object.keys(map).length === 0) {
      return ''
    }
    map = removeEmptyKeys(map)
    map = sortObject(map)
    return JSON.stringify(map)
  }

  async function apiSign(timestamp, method, requestUrl, body, secretkey) {
    const content = timestamp + method.toUpperCase() + getPath(requestUrl) + getJsonBody(body)
    return hmacSha256Base64(content, secretkey)
  }

  /**
   * @param {object} opts
   * @param {string} opts.url
   * @param {'GET'|'POST'} [opts.method]
   * @param {unknown} [opts.body]
   * @param {string} opts.appId
   * @param {string} opts.appSecret
   * @param {Record<string, string>} [opts.headers]
   */
  async function signedFetch(opts) {
    const method = (opts.method || 'POST').toUpperCase()
    const bodyString = opts.body === undefined ? '' : JSON.stringify(opts.body)
    const timestamp = String(Date.now())
    const sign = await apiSign(timestamp, method, opts.url, bodyString, opts.appSecret)
    const headers = Object.assign(
      bodyString !== '' ? { 'Content-Type': 'application/json' } : {},
      opts.headers || {},
      {
        appid: opts.appId,
        timestamp: timestamp,
        sign: sign
      }
    )
    const response = await fetch(opts.url, {
      method: method,
      headers: headers,
      body: bodyString === '' ? undefined : bodyString
    })
    const envelope = await response.json()
    return { response: response, envelope: envelope }
  }

  function apiBase(environment) {
    return environment === 'PRODUCTION'
      ? 'https://api.alchemypay.org'
      : 'https://api-test.alchemytech.cc'
  }

  function throwApiError(envelope, response, fallback) {
    const err = new Error((envelope && envelope.returnMsg) || fallback)
    err.returnCode = envelope && envelope.returnCode
    err.traceId = envelope && envelope.traceId
    err.envelope = envelope
    err.status = response && response.status
    throw err
  }

  /**
   * Demo: signed POST getToken（不要带 access-token）。
   */
  async function getToken(opts) {
    const base = apiBase(opts.environment)
    const url = opts.getTokenUrl || base + '/open/api/v4/merchant/getToken'
    const body = {}
    if (opts.email) body.email = opts.email
    else if (opts.uid) body.uid = opts.uid
    else throw new Error('getToken requires email or uid')

    const result = await signedFetch({
      url: url,
      method: 'POST',
      body: body,
      appId: opts.appId,
      appSecret: opts.appSecret
    })
    const envelope = result.envelope
    if (!result.response.ok || !envelope || envelope.returnCode !== '0000') {
      throwApiError(envelope, result.response, 'Get token failed')
    }
    const accessToken = envelope.data && envelope.data.accessToken
    if (!accessToken || !String(accessToken).trim()) {
      throw new Error('Get token response is missing accessToken')
    }
    return {
      accessToken: String(accessToken).trim(),
      data: envelope.data,
      traceId: envelope.traceId,
      envelope: envelope
    }
  }

  /**
   * Prefer provided accessToken; else getToken via email/uid.
   */
  async function ensureAccessToken(opts) {
    const provided = opts.accessToken && String(opts.accessToken).trim()
    if (provided) return { accessToken: provided, from: 'provided' }
    const email = opts.email && String(opts.email).trim()
    const uid = opts.uid && String(opts.uid).trim()
    if (!email && !uid) {
      throw new Error('accessToken or email/uid is required for create-order')
    }
    const result = await getToken({
      environment: opts.environment,
      appId: opts.appId,
      appSecret: opts.appSecret,
      email: email || undefined,
      uid: uid || undefined,
      getTokenUrl: opts.getTokenUrl
    })
    return { accessToken: result.accessToken, from: 'getToken', traceId: result.traceId }
  }

  /**
   * Demo: signed POST create-order with access-token header.
   * Returns envelope.data (create-order response).
   */
  async function createOrder(opts) {
    const base = apiBase(opts.environment)
    const url = opts.createOrderUrl || base + '/open/api/v4/merchant/order/create'
    const accessToken = opts.accessToken && String(opts.accessToken).trim()
    if (!accessToken) {
      throw new Error('createOrder requires accessToken (request header access-token)')
    }
    const result = await signedFetch({
      url: url,
      method: 'POST',
      body: opts.order,
      appId: opts.appId,
      appSecret: opts.appSecret,
      headers: Object.assign({}, opts.headers || {}, { 'access-token': accessToken })
    })
    const envelope = result.envelope
    if (!result.response.ok || !envelope || envelope.returnCode !== '0000') {
      throwApiError(envelope, result.response, 'Create order failed')
    }
    return { data: envelope.data, traceId: envelope.traceId, envelope: envelope }
  }

  global.PaySdkDemoSignedApi = {
    apiSign: apiSign,
    signedFetch: signedFetch,
    getToken: getToken,
    ensureAccessToken: ensureAccessToken,
    createOrder: createOrder,
    apiBase: apiBase
  }
})(window)
