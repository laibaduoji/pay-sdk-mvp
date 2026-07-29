import type {
  ApiResponse,
  ApplePayParams,
  CreateOrderRequest,
  CreateOrderResponse,
  CreateOrderRisk,
  Environment,
  GooglePayParams,
  PayApiConfig,
  PayMethod,
  PayRequest,
  PayResponse,
  QueryOrderResponse
} from './types.js'
import { apiSign } from './sign.js'

const SUCCESS_RETURN_CODE = '0000'

export interface GetTokenRequest {
  email?: string
  uid?: string
}

export interface GetTokenResponse {
  accessToken: string
  id?: string
  email?: string
}

export class PayApiError extends Error {
  readonly returnCode?: string
  readonly traceId?: string
  readonly status?: number

  constructor(
    message: string,
    details: { returnCode?: string; traceId?: string; status?: number } = {}
  ) {
    super(message)
    this.name = 'PayApiError'
    this.returnCode = details.returnCode
    this.traceId = details.traceId
    this.status = details.status
  }
}

/** 服务端创建订单 data（method 可选，可由 paymentScript 推断） */
interface CreateOrderWireData {
  orderNo: string
  paymentScript: GooglePayParams | ApplePayParams
  risk?: CreateOrderRisk
  method?: PayMethod
  environment?: Environment
  validateMerchantUrl?: string
}

function isGooglePayScript(script: GooglePayParams | ApplePayParams): script is GooglePayParams {
  return Array.isArray((script as GooglePayParams).allowedPaymentMethods)
}

function isApplePayScript(script: GooglePayParams | ApplePayParams): script is ApplePayParams {
  return Array.isArray((script as ApplePayParams).merchantCapabilities) || 'total' in script
}

export function normalizeCreateOrderResponse(data: CreateOrderWireData): CreateOrderResponse {
  if (!data?.orderNo) {
    throw new PayApiError('Create order response is missing orderNo')
  }
  if (!data.paymentScript || typeof data.paymentScript !== 'object') {
    throw new PayApiError('Create order response is missing paymentScript')
  }

  let method = data.method
  if (!method) {
    if (isGooglePayScript(data.paymentScript)) method = 'googlePay'
    else if (isApplePayScript(data.paymentScript)) method = 'applePay'
    else throw new PayApiError('Create order response paymentScript is not Google or Apple Pay')
  }

  if (method === 'googlePay') {
    const script = { ...(data.paymentScript as GooglePayParams) }
    const environment = data.environment || script.environment
    if ('environment' in script) delete script.environment
    return {
      orderNo: data.orderNo,
      method: 'googlePay',
      environment,
      paymentScript: script,
      risk: data.risk
    }
  }

  return {
    orderNo: data.orderNo,
    method: 'applePay',
    environment: data.environment,
    paymentScript: data.paymentScript as ApplePayParams,
    validateMerchantUrl: data.validateMerchantUrl,
    risk: data.risk
  }
}

/** 查单 wire：H5 用 orderStatus，Apifox 用 orderState */
interface QueryOrderWireData extends Omit<QueryOrderResponse, 'orderState'> {
  orderState?: number
  orderStatus?: number
}

export function normalizeQueryOrderResponse(data: QueryOrderWireData): QueryOrderResponse {
  const raw = data.orderState ?? data.orderStatus
  const orderState = typeof raw === 'number' ? raw : Number(raw)
  if (!Number.isFinite(orderState)) {
    throw new PayApiError('Query order response is missing orderState')
  }
  const orderNo = data.orderNo
  if (!orderNo) {
    throw new PayApiError('Query order response is missing orderNo')
  }
  return {
    ...data,
    orderNo,
    orderState,
    s3dsUrl: typeof data.s3dsUrl === 'string' ? data.s3dsUrl : undefined,
    s3dsComplete: data.s3dsComplete === true
  }
}

export class PayApiClient {
  private readonly config: PayApiConfig
  private readonly fetcher: typeof fetch
  private accessToken: string | undefined
  private lastTraceId: string | undefined

  constructor(config: PayApiConfig) {
    this.config = config
    this.fetcher = config.fetch || window.fetch.bind(window)
    this.accessToken = config.accessToken?.trim() || undefined
  }

  getAccessToken(): string | undefined {
    return this.accessToken
  }

  getLastTraceId(): string | undefined {
    return this.lastTraceId
  }

  /** 重建 client 时保留最近一次 traceId */
  restoreLastTraceId(traceId?: string): void {
    if (traceId) this.lastTraceId = traceId
  }

  /**
   * 优先使用已有 / 传入的 accessToken；否则用 email 或 uid 调 getToken。
   */
  async ensureAccessToken(identity: {
    accessToken?: string
    email?: string
    uid?: string
  }): Promise<string> {
    const provided = identity.accessToken?.trim()
    if (provided) {
      this.accessToken = provided
      return provided
    }
    if (this.accessToken) return this.accessToken

    const email = identity.email?.trim()
    const uid = identity.uid?.trim()
    if (!email && !uid) {
      throw new PayApiError(
        'accessToken or email/uid is required (prefer passing accessToken from your server)'
      )
    }

    const body: GetTokenRequest = email ? { email } : { uid: uid! }
    const data = await this.getToken(body)
    const token = data?.accessToken?.trim()
    if (!token) {
      throw new PayApiError('Get token response is missing accessToken')
    }
    this.accessToken = token
    return token
  }

  getToken(request: GetTokenRequest): Promise<GetTokenResponse> {
    return this.request<GetTokenResponse>(this.config.getTokenUrl, 'POST', request)
  }

  async createOrder(request: CreateOrderRequest): Promise<CreateOrderResponse> {
    const data = await this.request<CreateOrderWireData>(
      this.config.createOrderUrl,
      'POST',
      request
    )
    return normalizeCreateOrderResponse(data)
  }

  getValidateMerchantUrl(override?: string): string {
    return override || this.config.validateMerchantUrl
  }

  validateMerchant(
    url: string | undefined,
    orderNo: string,
    validationURL: string
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(this.getValidateMerchantUrl(url), 'POST', {
      orderNo,
      validationURL
    })
  }

  pay(request: PayRequest): Promise<PayResponse> {
    return this.request<PayResponse>(this.config.payUrl, 'POST', request)
  }

  async queryOrder(orderNo: string): Promise<QueryOrderResponse> {
    const base = this.config.queryOrderUrl.replace(/\/$/, '')
    const url = `${base}?orderNo=${encodeURIComponent(orderNo)}`
    const data = await this.request<QueryOrderWireData>(url, 'GET')
    return normalizeQueryOrderResponse(data)
  }

  private async resolveHeaders(
    url: string,
    method: 'GET' | 'POST',
    bodyString: string
  ): Promise<Record<string, string>> {
    const configured =
      typeof this.config.headers === 'function' ? await this.config.headers() : this.config.headers
    const headers: Record<string, string> =
      bodyString !== '' ? { 'Content-Type': 'application/json', ...configured } : { ...configured }

    const { appId, appSecret } = this.config
    if (appId && appSecret) {
      const timestamp = String(Date.now())
      const sign = await apiSign(timestamp, method, url, bodyString, appSecret)
      headers.appid = appId
      headers.timestamp = timestamp
      headers.sign = sign
    }

    // TEMP: server currently does not require access-token; keep for later restore
    // // getToken 本身不需要 access-token；其它业务接口需要
    // const isGetToken = url.replace(/\/$/, '') === this.config.getTokenUrl.replace(/\/$/, '')
    // if (this.accessToken && !isGetToken) {
    //   headers['access-token'] = this.accessToken
    // }

    if (this.config.getFingerprintId) {
      const fingerprintId = await this.config.getFingerprintId()
      if (fingerprintId) headers['fingerprint-id'] = fingerprintId
    }

    return headers
  }

  private async request<T>(url: string, method: 'GET' | 'POST', body?: unknown): Promise<T> {
    const bodyString = body === undefined ? '' : JSON.stringify(body)
    let response: Response
    try {
      response = await this.fetcher(url, {
        method,
        headers: await this.resolveHeaders(url, method, bodyString),
        body: bodyString === '' ? undefined : bodyString
      })
    } catch (error) {
      throw error instanceof Error ? error : new PayApiError('Pay API network request failed')
    }

    let envelope: ApiResponse<T>
    try {
      envelope = (await response.json()) as ApiResponse<T>
    } catch {
      throw new PayApiError(
        response.ok
          ? 'Pay API returned invalid JSON'
          : `Pay API request failed with status ${response.status}`,
        { status: response.status }
      )
    }

    if (envelope?.traceId) {
      this.lastTraceId = envelope.traceId
    }

    if (!response.ok || !envelope || envelope.returnCode !== SUCCESS_RETURN_CODE) {
      throw new PayApiError(envelope?.returnMsg || 'Pay API request failed', {
        returnCode: envelope?.returnCode,
        traceId: envelope?.traceId || this.lastTraceId,
        status: response.status
      })
    }

    return envelope.data
  }
}
