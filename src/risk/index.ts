import type { CreateOrderRisk, Environment, PayRiskPayload, RuntimeWalletConfig } from '../types.js'
import { collectForter } from './forter.js'
import { collectCheckout } from './checkout.js'
import { collectWorldPay } from './worldpay.js'

function isEnabled(enabled?: boolean): boolean {
  return enabled === true
}

/**
 * 按 Forter → Checkout → WorldPay 并行采集（支付 body）。
 * Fingerprint 由 SDK init 独立采集，仅走请求头 fingerprint-id。
 * 仅 enabled === true 的块会执行；失败字段不写入 payload。
 */
export async function collectRisk(
  risk?: CreateOrderRisk,
  environment?: Environment
): Promise<PayRiskPayload> {
  if (!risk) return {}

  const tasks: Array<Promise<void>> = []
  const payload: PayRiskPayload = {}

  if (isEnabled(risk.forter?.enabled)) {
    tasks.push(
      collectForter(risk.forter).then((token) => {
        if (token) payload.forter = { token }
      })
    )
  }

  if (isEnabled(risk.checkout?.enabled)) {
    tasks.push(
      collectCheckout(risk.checkout, environment).then((deviceSessionId) => {
        if (deviceSessionId) payload.checkout = { deviceSessionId }
      })
    )
  }

  if (isEnabled(risk.worldPay?.enabled)) {
    tasks.push(
      collectWorldPay(risk.worldPay).then((sessionId) => {
        if (sessionId) payload.worldPay = { sessionId }
      })
    )
  }

  await Promise.all(tasks)
  return payload
}

/** 支付路径：优先复用预采集 Promise，否则当场开始采集。 */
export function resolveRiskCollection(config: RuntimeWalletConfig): Promise<PayRiskPayload> {
  if (config.riskCollection) return config.riskCollection
  return collectRisk(config.risk, config.environment)
}
