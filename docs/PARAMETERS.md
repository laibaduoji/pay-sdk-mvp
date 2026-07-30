# 参数说明文档

`PaySdk.init(config)` 的完整参数说明。图例：**必传** = 必须提供，否则 `init` 抛错；可选 = 不传则使用默认值。

SDK 编排：**商户已创建订单** → 钱包授权 → 支付 →（需要时）查询。  
`order` 为创建订单**响应**（含 `token` / `paymentScript` / `risk`）。SDK **不**调创建订单、**不**签名；后续接口带头 `payment-hub-token`。

---

## 1. 顶层参数（`config`）

| 参数             | 类型                     |  必传  | 默认值         | 说明                                                                                                         |
| ---------------- | ------------------------ | :----: | -------------- | ------------------------------------------------------------------------------------------------------------ |
| `container`      | `string \| HTMLElement`  | **是** | —              | 按钮渲染容器                                                                                                 |
| `order`          | `CreateOrderResponse`    | **是** | —              | 商户侧创建订单响应；须含 `orderNo` / `paymentScript` / `token`                                               |
| `environment`    | `'TEST' \| 'PRODUCTION'` |   否   | `'PRODUCTION'` | 决定内置 API、Google Pay、Checkout Risk                                                                      |
| `api`            | `Partial<PayApiConfig>`  |   否   | 按环境内置     | 默认用 `src/endpoints.ts`；可只传 headers / 轮询 / 覆盖 URL；**无需** appId/appSecret                        |
| `onOrderCreated` | `(order) => void`        |   否   | —              | `ready()` 规范化订单后回调（订单已由商户创建）                                                               |
| `onStatusChange` | `(order) => void`        |   否   | —              | 接口 4 每次轮询成功后回调                                                                                    |
| `onAction`       | `(action) => void`       |   否   | —              | 二次动作回调；含 `MD`/`JWT`/`action`/`webUrl` 等完整字段                                                     |
| `actionMode`     | `'callback' \| 'auto'`   |   否   | `'callback'`   | 默认只回调；`auto` 才尝试打开                                                                                |
| `openAction`     | `(action) => boolean?`   |   否   | —              | `actionMode: 'auto'` 时自定义打开（如 JS Bridge）；也可随时 `sdk.openAction(action)`；返回 `true` 表示已处理 |
| `onComplete`     | `(result) => void`       |   否   | —              | 编排结束；包括非终态的 `s3dsComplete`                                                                        |
| `onSuccess`      | `(result) => void`       |   否   | —              | 接口 3 直接成功或查询状态为 `succeeded`                                                                      |
| `onError`        | `(error: Error) => void` |   否   | —              | API、钱包或终态失败                                                                                          |
| `onCancel`       | `() => void`             |   否   | —              | 用户取消钱包                                                                                                 |

### 1.1 示例

```js
// 商户服务端已创建订单，拿到 data（含 token）
const order = createOrderResponseFromYourServer

const sdk = PaySdk.init({
  container: '#pay-container',
  environment: 'TEST',
  order: order,
  api: {
    pollIntervalMs: 2000,
    pollTimeoutMs: 300000
  },
  onAction(action) {
    console.log(action)
  },
  onOrderCreated: (order) => console.log(order.orderNo, order.token),
  onStatusChange: (order) => console.log(order.orderState),
  onComplete: (result) => console.log('flow complete', result.order?.orderState),
  onSuccess: (result) => console.log(result.orderNo, result.order?.orderState),
  onError: (error) => console.error(error)
})

sdk.ready().then(() => sdk.mount())
```

内置地址（见 [`src/endpoints.ts`](../src/endpoints.ts)）：

| 环境                 | API 根域名                        |
| -------------------- | --------------------------------- |
| `TEST`               | `https://api-test.alchemytech.cc` |
| `PRODUCTION`（默认） | `https://api.alchemypay.org`      |

路径：`/payment-hub/domain/verify`、`/payment-hub/alchemy-pay`、
`/payment-hub/order/detail`。  
SDK 自动带 `payment-hub-token: <order.token>`（订单详情凭 token 查，不传 orderNo）。创建订单路径仍内置，供 demo / 商户服务端参考，**SDK 编排不调用**。

> 创建订单若返回 `validateMerchantUrl`，优先使用响应值；未返回则使用环境内置地址。

Google Pay **TEST** 环境默认（创建订单未下发时 SDK 补齐，有值则保留）：

| 字段                | 默认值                 |
| ------------------- | ---------------------- |
| `merchantId`        | `12345678901234567890` |
| `merchantName`      | `Example Merchant`     |
| `gateway`           | `unlimint`             |
| `gatewayMerchantId` | `googletest`           |

`ready()` 使用传入的创建订单响应加载钱包并检查可用性；`mount()` 也可直接调用。  
业务接口统一响应须满足 `returnCode === '0000'`。轮询默认每 2 秒一次，最长 5 分钟。

创建订单响应中的 `risk.*.enabled` 会在 `ready()` 时**立即预采集**；支付时复用。

二次动作（WebView 友好）：

| `actionMode`       | 行为                                                                  |
| ------------------ | --------------------------------------------------------------------- |
| `callback`（默认） | 只调用 `onAction(action)`，**不**自动跳转 / 开 iframe；轮询继续       |
| `auto`             | 先调 `onAction`，再试 `openAction`（Bridge）；未处理则用 SDK 内置打开 |

商户也可随时调用 `sdk.openAction(action)`。

---

## 2. `order`（创建订单响应）

| 参数                  | 类型                        |  必传  | 说明                                |
| --------------------- | --------------------------- | :----: | ----------------------------------- |
| `orderNo`             | `string`                    | **是** | 平台订单号                          |
| `paymentScript`       | `object`                    | **是** | Google / Apple 原生参数             |
| `token`               | `string`                    | **是** | 写入后续请求头 `payment-hub-token`  |
| `method`              | `'googlePay' \| 'applePay'` |   否   | 可省略；SDK 按 `paymentScript` 推断 |
| `environment`         | `'TEST' \| 'PRODUCTION'`    |   否   | 可覆盖 init `environment`           |
| `risk`                | `object`                    |   否   | Forter / Checkout / WorldPay        |
| `validateMerchantUrl` | `string`                    |   否   | 仅 Apple；覆盖内置域名校验地址      |

创建订单**请求**字段（`side` / `amount` / …）由商户服务端调用 openapi，不传入 SDK。契约见 [`docs/pay-api/`](./pay-api/)。

---

## 3. `risk`（创建订单下发）

创建订单 `data.risk` 由 SDK 自动使用。仅 `enabled === true` 的厂商会采集并写入**支付 body**；失败不阻断支付。

**Fingerprint 不在创建订单下发**：SDK `init` 用内置默认采集，仅通过请求头 `fingerprint-id` 传递。

| 块         | 上送字段（支付 body）           | 可覆盖配置（有值覆盖 SDK 默认）         |
| ---------- | ------------------------------- | --------------------------------------- |
| `forter`   | `risk.forter.token`             | `siteId`                                |
| `checkout` | `risk.checkout.deviceSessionId` | `publicKey`、`scriptUrl`、`integrity`   |
| `worldPay` | `risk.worldPay.sessionId`       | `jwt`（必填才能采）、`bin`、`actionUrl` |

`forter` / `checkout` 可只传 `{ enabled: true }` 使用内置默认。  
`worldPay` 至少需要服务端下发的动态 `jwt`。

---

## 4. 成功回调结果（`onSuccess` / `onComplete`）

```js
// Google Pay
{
  method: ('googlePay',
    token, // paymentData.paymentMethodData.tokenizationData.token
    paymentMethodData,
    billingAddress, // 创建订单要求账单地址时
    email,
    raw,
    risk,
    orderNo,
    paymentResponse,
    order) // 轮询结束时的状态（如有）
}

// Apple Pay
{
  method: ('applePay',
    token,
    billingContact,
    shippingContact,
    raw,
    risk,
    orderNo,
    paymentResponse,
    order)
}
```

---

## 5. Demo

| 示例          | 文件                                                        |
| ------------- | ----------------------------------------------------------- |
| Mock 编排     | [`demo/08-managed-flow.html`](../demo/08-managed-flow.html) |
| 真实 API 联调 | [`demo/09-live-api.html`](../demo/09-live-api.html)         |

Demo 09 用 [`demo/signed-api.js`](../demo/signed-api.js) **签名创建订单**（仅 demo 持有 appSecret）：先取 `accessToken`（或 email/uid getToken），创建订单请求头带 `access-token`，再把响应（含 `token`）交给 SDK。
