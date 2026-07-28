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

export class PayApiClient {
  private readonly config: PayApiConfig
  private readonly fetcher: typeof fetch

  constructor(config: PayApiConfig) {
    this.config = config
    this.fetcher = config.fetch || window.fetch.bind(window)
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

  queryOrder(orderNo: string): Promise<QueryOrderResponse> {
    const base = this.config.queryOrderUrl.replace(/\/$/, '')
    const url = `${base}?orderNo=${encodeURIComponent(orderNo)}`
    return this.request<QueryOrderResponse>(url, 'GET')
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

    if (!response.ok || !envelope || envelope.returnCode !== SUCCESS_RETURN_CODE) {
      throw new PayApiError(envelope?.returnMsg || 'Pay API request failed', {
        returnCode: envelope?.returnCode,
        traceId: envelope?.traceId,
        status: response.status
      })
    }

    return envelope.data
  }
}
