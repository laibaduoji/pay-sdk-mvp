# 参数说明文档

`PaySdk.init(config)` 的完整参数说明。图例：**必传** = 必须提供，否则 `init` 抛错；可选 = 不传则使用默认值。

SDK **仅支持完整支付编排**：创建订单 → 钱包授权 → 支付 →（需要时）查询。钱包类型、金额、
`params`、`risk` 均由创建订单响应决定，不再支持仅钱包初始化。

---

## 1. 顶层参数（`config`）

| 参数             | 类型                     |  必传  | 默认值         | 说明                                                                                                         |
| ---------------- | ------------------------ | :----: | -------------- | ------------------------------------------------------------------------------------------------------------ |
| `container`      | `string \| HTMLElement`  | **是** | —              | 按钮渲染容器                                                                                                 |
| `order`          | `CreateOrderRequest`     | **是** | —              | `amount` / `currency` / `countryCode`；SDK 调接口 1 创建订单                                                 |
| `environment`    | `'TEST' \| 'PRODUCTION'` |   否   | `'PRODUCTION'` | 决定内置 API、Google Pay、Checkout Risk                                                                      |
| `api`            | `Partial<PayApiConfig>`  |   否   | 按环境内置     | 默认用 `src/endpoints.ts`；可只传 headers / 覆盖 URL                                                         |
| `onOrderCreated` | `(order) => void`        |   否   | —              | 接口 1 成功后回调                                                                                            |
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
const sdk = PaySdk.init({
  container: '#pay-container',
  // 不传则默认 PRODUCTION；TEST 时使用测试 API / Google Pay TEST / Checkout 沙盒
  environment: 'TEST',
  order: { amount: '10.00', currency: 'USD', countryCode: 'US' },
  // api 可选：默认按 environment 取内置地址（src/endpoints.ts）
  api: {
    headers: () => ({ Authorization: `Bearer ${getAccessToken()}` }),
    pollIntervalMs: 2000,
    pollTimeoutMs: 300000
  },
  // 默认 actionMode: 'callback' — 只通过 onAction 吐给商户，适合 App WebView
  onAction(action) {
    console.log(action)
    // 商户自行开窗 / Native Bridge；或授权后调用 sdk.openAction(action)
  },
  onOrderCreated: (order) => console.log(order.orderId),
  onStatusChange: (order) => console.log(order.status),
  onComplete: (result) => console.log('flow complete', result.order?.status),
  onSuccess: (result) => console.log(result.orderId, result.order?.status),
  onError: (error) => console.error(error)
})

sdk.ready().then(() => sdk.mount())
```

内置地址（见 [`src/endpoints.ts`](../src/endpoints.ts)）：

| 环境                 | API 根域名                        |
| -------------------- | --------------------------------- |
| `TEST`               | `https://api-test.alchemytech.cc` |
| `PRODUCTION`（默认） | `https://api.alchemypay.org`      |

路径：`/v1/pay/orders`、`/pay/apple/domainName/verify`（Apple Pay 域名校验）、
`/v1/pay/payments`、`/v1/pay/orders/{orderId}`。本地代理时可在 `api` 里覆盖 URL。
创建订单若返回 `validateMerchantUrl`，优先使用响应值；未返回则使用环境内置地址。

Google Pay **TEST** 环境默认（创建订单未下发时 SDK 补齐，有值则保留）：

| 字段                | 默认值                 |
| ------------------- | ---------------------- |
| `merchantId`        | `12345678901234567890` |
| `merchantName`      | `Example Merchant`     |
| `gateway`           | `unlimint`             |
| `gatewayMerchantId` | `googletest`           |

`ready()` 先创建订单，再按响应加载钱包并检查可用性；`mount()` 也可直接调用，会自动完成这一步。
四个 API 统一响应须满足 `returnCode === '0000'`。轮询默认每 2 秒一次，最长 5 分钟，瞬时网络错误最多连续重试 4 次。

创建订单成功后，按响应 `risk.*.enabled` **立即预采集**风控；支付时已完成则直接用，进行中则
`await`。

二次动作（WebView 友好）：

| `actionMode`       | 行为                                                                  |
| ------------------ | --------------------------------------------------------------------- |
| `callback`（默认） | 只调用 `onAction(action)`，**不**自动跳转 / 开 iframe；轮询继续       |
| `auto`             | 先调 `onAction`，再试 `openAction`（Bridge）；未处理则用 SDK 内置打开 |

商户也可随时调用 `sdk.openAction(action)`。

---

## 2. `order`

| 参数          | 类型     |  必传  | 说明                     |
| ------------- | -------- | :----: | ------------------------ |
| `amount`      | `string` | **是** | 金额字符串，如 `'10.00'` |
| `currency`    | `string` | **是** | 货币代码，如 `'USD'`     |
| `countryCode` | `string` | **是** | 国家代码，如 `'US'`      |

创建订单响应中的钱包 `params`（含金额展示名、账单地址开关、tokenization 等）由后端决定。
契约见 [`docs/pay-api/`](./pay-api/)。

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
    orderId,
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
    orderId,
    paymentResponse,
    order)
}
```

---

## 5. Demo

| 示例          | 文件                                                 |
| ------------- | ---------------------------------------------------- |
| Mock 完整编排 | [08-managed-flow.html](../demo/08-managed-flow.html) |

勾选环境 / 风控 / 账单地址 / 支付结果后，由 [`demo/mock-api.js`](../demo/mock-api.js)
返回对应创建订单与支付数据（`api.fetch`），无需真实后端。

创建订单后预采风控；二次动作默认 `callback`，可确认后 `sdk.openAction(action)`。
若设 `actionMode: 'auto'` 或调用 `sdk.openAction`，SDK 内置行为为：

- `MD + JWT + action`：390×400 WorldPay challenge iframe，并轮询
- `threeDSMethodData + methodUrl`：隐藏 Shift4 method iframe，并轮询
- `webUrl` / `s3dsUrl`：`location.assign`（整页跳转后轮询自然结束）
