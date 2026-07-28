/**
 * AlchemyPay API Sign — ported from official JavaScript sample:
 * https://alchemypay.readme.io/docs/api-sign
 *
 * HMAC uses Web Crypto (browser) instead of Node crypto.createHmac.
 */

function bytesToBase64(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes)
  let binary = ''
  for (let i = 0; i < view.length; i++) {
    binary += String.fromCharCode(view[i]!)
  }
  return btoa(binary)
}

async function hmacSha256Base64(content: string, secretkey: string): Promise<string> {
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

export function getPath(requestUrl: string): string {
  const uri = new URL(requestUrl)
  const path = uri.pathname
  const params = Array.from(uri.searchParams.entries())

  if (params.length === 0) {
    return path
  }

  const sortedParams = [...params].sort(([aKey], [bKey]) => aKey.localeCompare(bKey))
  const queryString = sortedParams.map(([key, value]) => `${key}=${value}`).join('&')
  return `${path}?${queryString}`
}

function removeEmptyKeys(map: Record<string, unknown>): Record<string, unknown> {
  const retMap: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(map)) {
    if (value !== null && value !== '') {
      retMap[key] = value
    }
  }

  return retMap
}

function sortList(list: unknown[]): unknown[] {
  const objectList: unknown[] = []
  const intList: number[] = []
  const floatList: number[] = []
  const stringList: string[] = []
  const jsonArray: unknown[] = []

  for (const item of list) {
    if (typeof item === 'object' && item !== null) {
      jsonArray.push(item)
    } else if (typeof item === 'number' && Number.isInteger(item)) {
      intList.push(item)
    } else if (typeof item === 'number') {
      floatList.push(item)
    } else if (typeof item === 'string') {
      stringList.push(item)
    } else {
      intList.push(item as number)
    }
  }

  intList.sort((a, b) => a - b)
  floatList.sort((a, b) => a - b)
  stringList.sort()

  objectList.push(...intList, ...floatList, ...stringList, ...jsonArray)
  list.length = 0
  list.push(...objectList)

  const retList: unknown[] = []

  for (const item of list) {
    if (typeof item === 'object' && item !== null) {
      retList.push(sortObject(item))
    } else {
      retList.push(item)
    }
  }

  return retList
}

function sortMap(map: Record<string, unknown>): Record<string, unknown> {
  const sortedMap = new Map(
    Object.entries(removeEmptyKeys(map)).sort(([aKey], [bKey]) => aKey.localeCompare(bKey))
  )

  for (const [key, value] of sortedMap.entries()) {
    if (typeof value === 'object' && value !== null) {
      sortedMap.set(key, sortObject(value))
    }
  }

  return Object.fromEntries(sortedMap.entries())
}

function sortObject(obj: unknown): unknown {
  if (typeof obj === 'object' && obj !== null) {
    if (Array.isArray(obj)) {
      return sortList(obj)
    }
    return sortMap(obj as Record<string, unknown>)
  }

  return obj
}

export function getJsonBody(body: string): string {
  let map: Record<string, unknown>

  try {
    map = JSON.parse(body) as Record<string, unknown>
  } catch {
    map = {}
  }

  if (!map || typeof map !== 'object' || Array.isArray(map) || Object.keys(map).length === 0) {
    return ''
  }

  map = removeEmptyKeys(map)
  map = sortObject(map) as Record<string, unknown>

  return JSON.stringify(map)
}

/**
 * @param body JSON string for POST, or empty string for GET
 */
export async function apiSign(
  timestamp: string,
  method: string,
  requestUrl: string,
  body: string,
  secretkey: string
): Promise<string> {
  const content = timestamp + method.toUpperCase() + getPath(requestUrl) + getJsonBody(body)
  return hmacSha256Base64(content, secretkey)
}
