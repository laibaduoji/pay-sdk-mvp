import type { RiskWorldPayConfig } from '../types.js'

/**
 * WorldPay DDC session 采集占位：等后续提供 jwt / iframe 逻辑。
 * enabled 时当前返回 ""，不阻断支付。
 */
export async function collectWorldPay(_cfg?: RiskWorldPayConfig): Promise<string> {
  return ''
}
