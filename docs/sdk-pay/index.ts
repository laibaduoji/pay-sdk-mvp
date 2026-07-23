/**
 * 商户可见契约入口（四个 HTTP 接口）。
 *
 * | # | 文件 | 方法 | 说明 |
 * |---|------|------|------|
 * | 1 | 1-create-order.ts | POST | 创建订单 |
 * | 2 | 2-validate-merchant.ts | POST | Apple Pay 域名校验 |
 * | 3 | 3-pay.ts | POST | 支付 |
 * | 4 | 4-query-order.ts | GET | 查询订单状态 |
 *
 * 共用响应壳见 common.ts。说明文档见 ../sdk-pay.md。
 */

export * from './common'
export * from './1-create-order'
export * from './2-validate-merchant'
export * from './3-pay'
export * from './4-query-order'
