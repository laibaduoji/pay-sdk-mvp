import type {
  ApiResponse,
  CreateOrderRequest,
  CreateOrderResponse,
  PayApiConfig,
  PayRequest,
  PayResponse,
  QueryOrderResponse
} from './types.js'

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

export class PayApiClient {
  private readonly config: PayApiConfig
  private readonly fetcher: typeof fetch

  constructor(config: PayApiConfig) {
    this.config = config
    this.fetcher = config.fetch || window.fetch.bind(window)
  }

  createOrder(request: CreateOrderRequest): Promise<CreateOrderResponse> {
    return this.request<CreateOrderResponse>(this.config.createOrderUrl, 'POST', request)
  }

  getValidateMerchantUrl(override?: string): string {
    return override || this.config.validateMerchantUrl
  }

  validateMerchant(
    url: string | undefined,
    orderId: string,
    validationURL: string
  ): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(this.getValidateMerchantUrl(url), 'POST', {
      orderId,
      validationURL
    })
  }

  pay(request: PayRequest): Promise<PayResponse> {
    return this.request<PayResponse>(this.config.payUrl, 'POST', request)
  }

  queryOrder(orderId: string): Promise<QueryOrderResponse> {
    const encoded = encodeURIComponent(orderId)
    const template = this.config.queryOrderUrl
    const url = template.includes('{orderId}')
      ? template.replace('{orderId}', encoded)
      : `${template.replace(/\/$/, '')}/${encoded}`
    return this.request<QueryOrderResponse>(url, 'GET')
  }

  private async headers(includeContentType: boolean): Promise<Record<string, string>> {
    const configured =
      typeof this.config.headers === 'function' ? await this.config.headers() : this.config.headers
    return includeContentType
      ? { 'Content-Type': 'application/json', ...configured }
      : { ...configured }
  }

  private async request<T>(url: string, method: 'GET' | 'POST', body?: unknown): Promise<T> {
    let response: Response
    try {
      response = await this.fetcher(url, {
        method,
        headers: await this.headers(body !== undefined),
        body: body === undefined ? undefined : JSON.stringify(body)
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
