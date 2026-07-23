/**
 * 前后端对接契约入口（钱包支付四个 HTTP 接口）。
 *
 * | # | 文件 | 方法 | 说明 |
 * |---|------|------|------|
 * | 1 | create-order.ts | POST | 创建订单 |
 * | 2 | validate-merchant.ts | POST | Apple Pay 域名校验 |
 * | 3 | pay.ts | POST | 支付 |
 * | 4 | query-order.ts | GET | 查询订单状态 |
 *
 * 共用类型见 common.ts；说明文档见 README.md。
 */

export * from './common'
export * from './create-order'
export * from './validate-merchant'
export * from './pay'
export * from './query-order'
