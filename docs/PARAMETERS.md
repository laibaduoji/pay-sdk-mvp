# 参数说明文档

`PaySdk.init(config)` 的完整参数说明。图例：**必传** = 必须提供，否则 `init` 抛错；可选 = 不传则使用默认值。

---

## 1. 顶层参数（`config`）

| 参数                     | 类型                        |  必传  | 默认值         | 说明                                                                                                         |
| ------------------------ | --------------------------- | :----: | -------------- | ------------------------------------------------------------------------------------------------------------ |
| `container`              | `string \| HTMLElement`     | **是** | —              | 按钮渲染容器                                                                                                 |
| `order`                  | `CreateOrderRequest`        | 见说明 | —              | 完整编排模式必传；SDK 调接口 1 创建订单                                                                      |
| `environment`            | `'TEST' \| 'PRODUCTION'`    |   否   | `'PRODUCTION'` | 完整编排与钱包模式通用；决定内置 API / Google Pay / Checkout Risk                                            |
| `api`                    | `Partial<PayApiConfig>`     |   否   | 按环境内置     | 完整编排可选；默认用 `src/endpoints.ts`；可只传 headers / 覆盖 URL                                           |
| `method`                 | `'googlePay' \| 'applePay'` | 见说明 | —              | 仅钱包模式必传；完整模式由创建订单响应决定                                                                   |
| `payment`                | `PaymentConfig`             | 见说明 | —              | 仅钱包模式必传；完整模式由创建订单响应决定                                                                   |
| `billingAddressRequired` | `boolean`                   |   否   | `false`        | 仅钱包模式配置；完整模式由钱包 params 决定                                                                   |
| `googlePay`              | `GooglePayConfig`           | 见说明 | —              | 仅钱包模式且 `method === 'googlePay'` 时必传                                                                 |
| `applePay`               | `ApplePayConfig`            | 见说明 | —              | 仅钱包模式且 `method === 'applePay'` 时必传                                                                  |
| `risk`                   | `CreateOrderRisk`           |   否   | —              | 仅钱包模式手动传；完整模式读取创建订单响应                                                                   |
| `onOrderCreated`         | `(order) => void`           |   否   | —              | 接口 1 成功后回调                                                                                            |
| `onStatusChange`         | `(order) => void`           |   否   | —              | 接口 4 每次轮询成功后回调                                                                                    |
| `onAction`               | `(action) => void`          |   否   | —              | 二次动作回调；含 `MD`/`JWT`/`action`/`webUrl` 等完整字段                                                     |
| `actionMode`             | `'callback' \| 'auto'`      |   否   | `'callback'`   | 完整编排：默认只回调；`auto` 才尝试打开                                                                      |
| `openAction`             | `(action) => boolean?`      |   否   | —              | `actionMode: 'auto'` 时自定义打开（如 JS Bridge）；也可随时 `sdk.openAction(action)`；返回 `true` 表示已处理 |
| `onComplete`             | `(result) => void`          |   否   | —              | 编排结束；包括非终态的 `s3dsComplete`                                                                        |
| `onSuccess`              | `(result) => void`          |   否   | —              | 接口 3 直接成功或查询状态为 `succeeded`                                                                      |
| `onError`                | `(error: Error) => void`    |   否   | —              | API、钱包或终态失败                                                                                          |
| `onCancel`               | `() => void`                |   否   | —              | 用户取消钱包                                                                                                 |

完整编排与仅钱包模式二选一。完整编排传 `order`（可选 `environment` / `api`），不要再传 `method / payment / googlePay / applePay`。

### 1.1 完整编排模式

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
    // action 含 type + url + MD/JWT/action 或 webUrl / methodUrl 等
    // 商户自行开窗 / Native Bridge；或授权后调用 sdk.openAction(action)
    console.log(action)
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
创建订单若返回 `validateMerchantUrl`，优先使用响应值；未返回则使用这里的环境地址。

`ready()` 在完整模式中先创建订单，再加载响应指定的钱包；`mount()` 也可直接调用，它会自动完成这一步。四个 API 的统一响应须满足 `returnCode === '0000'`。轮询默认每 2 秒一次，最长 5 分钟，瞬时网络错误最多连续重试 4 次。

二次动作（WebView 友好）：

| `actionMode`       | 行为                                                                  |
| ------------------ | --------------------------------------------------------------------- |
| `callback`（默认） | 只调用 `onAction(action)`，**不**自动跳转 / 开 iframe；轮询继续       |
| `auto`             | 先调 `onAction`，再试 `openAction`（Bridge）；未处理则用 SDK 内置打开 |

商户也可随时调用 `sdk.openAction(action)`（例如 JS Bridge 授权后再打开）。

---

## 2. `payment`（交易信息）

| 参数          | 类型     |  必传  | 默认值 | 说明                     |
| ------------- | -------- | :----: | ------ | ------------------------ |
| `amount`      | `string` | **是** | —      | 金额字符串，如 `'10.00'` |
| `currency`    | `string` | **是** | —      | 货币代码，如 `'USD'`     |
| `countryCode` | `string` | **是** | —      | 国家代码，如 `'US'`      |

> 支付单展示名称由 SDK 固定默认：Google Pay `totalPriceLabel = 'Total'`，Apple Pay `total.label = 'ALCHEMY GPS EUROPE UAB'`，不可通过参数覆盖。

---

## 3. `googlePay`

| 参数                        | 类型                    |         必传          | 默认值                           | 说明                                     |
| --------------------------- | ----------------------- | :-------------------: | -------------------------------- | ---------------------------------------- |
| `tokenizationSpecification` | `object`                |        **是**         | —                                | 令牌化配置，见第 6 节，原样透传给 Google |
| `merchantId`                | `string`                | 否（PRODUCTION 必传） | 省略                             | Google 分配的商户 ID；`TEST` 可不传      |
| `merchantName`              | `string`                |          否           | `'Merchant'`                     | 支付单上展示的商户名                     |
| `allowedAuthMethods`        | `string[]`              |          否           | `['PAN_ONLY', 'CRYPTOGRAM_3DS']` | 允许的认证方式                           |
| `allowedCardNetworks`       | `string[]`              |          否           | `['MASTERCARD', 'VISA']`         | 允许的卡组织                             |
| `button`                    | `GooglePayButtonConfig` |          否           | 见下                             | 官方 `createButton` 样式                 |

### `googlePay.button`

| 参数             | 类型     | 必传 | 默认值      | 说明                          |
| ---------------- | -------- | :--: | ----------- | ----------------------------- |
| `buttonColor`    | `string` |  否  | `'default'` | `default` / `black` / `white` |
| `buttonType`     | `string` |  否  | `'plain'`   | `buy` / `plain` / `pay` / …   |
| `buttonSizeMode` | `string` |  否  | `'fill'`    | `fill` / `static`             |
| `buttonLocale`   | `string` |  否  | 浏览器语言  | 按钮语言，如 `'en'`           |

---

## 4. `applePay`

| 参数                   | 类型                   |  必传  | 默认值                                               | 说明                                                    |
| ---------------------- | ---------------------- | :----: | ---------------------------------------------------- | ------------------------------------------------------- |
| `validateMerchantUrl`  | `string`               | **是** | —                                                    | 商户服务端域名校验接口，SDK 会 `POST { validationURL }` |
| `merchantCapabilities` | `string[]`             |   否   | `['supports3DS', 'supportsCredit', 'supportsDebit']` | 商户能力                                                |
| `supportedNetworks`    | `string[]`             |   否   | `['masterCard', 'visa']`                             | 支持的卡组织                                            |
| `button`               | `ApplePayButtonConfig` |   否   | 见下                                                 | 官方 `<apple-pay-button>` 展示                          |

### `applePay.button`

| 参数          | 类型     | 必传 | 默认值    | 说明                                |
| ------------- | -------- | :--: | --------- | ----------------------------------- |
| `buttonstyle` | `string` |  否  | `'black'` | `black` / `white` / `white-outline` |
| `type`        | `string` |  否  | `'plain'` | `buy` / `plain` / `pay` / …         |
| `locale`      | `string` |  否  | `'en-US'` | 按钮语言，如 `'zh-CN'`              |

---

## 5. 账单地址（`billingAddressRequired`）

设为 `true` 时，SDK 会在两端自动追加账单地址请求：

- **Google Pay**：在 `allowedPaymentMethods[0].parameters` 合并
  ```js
  { billingAddressRequired: true, billingAddressParameters: { format: 'FULL', phoneNumberRequired: false } }
  ```
- **Apple Pay**：追加
  ```js
  requiredBillingContactFields: ['name', 'postalAddress', 'phone', 'email']
  ```

不传或为 `false` 时不请求账单地址。

---

## 6. `risk`（风控采集）

把创建订单返回的 `risk` 原样传给 `PaySdk.init`。仅 `enabled === true` 的厂商会采集；失败字段不写入结果，**不阻断支付**。

| 块            | 采集结果字段                           | 可覆盖配置                               |
| ------------- | -------------------------------------- | ---------------------------------------- |
| `fingerprint` | `result.risk.fingerprint.visitorId`    | `apiKey`、`scriptUrlPattern`、`endpoint` |
| `forter`      | `result.risk.forter.token`             | `siteId`                                 |
| `checkout`    | `result.risk.checkout.deviceSessionId` | `publicKey`、`scriptUrl`、`integrity`    |
| `worldPay`    | `result.risk.worldPay.sessionId`       | `jwt`、`bin`、`actionUrl`                |

```js
PaySdk.init({
  // ...
  environment: 'TEST', // Checkout 未下发 publicKey 时走沙盒默认 key
  risk: {
    fingerprint: { enabled: true },
    forter: { enabled: true },
    checkout: { enabled: true },
    worldPay: { enabled: true, jwt: '...' }
  },
  onSuccess(result) {
    // 商户组 PayRequest.risk 时使用 result.risk
    console.log(result.risk)
  }
})
```

完整契约见 [`docs/pay-api/`](./pay-api/)。

---

## 7. `tokenizationSpecification`（Google Pay 必传）

由商户按支付网关要求提供，SDK 不做任何字段改写。二选一：

```js
// PAYMENT_GATEWAY：走支付网关
{
  type: 'PAYMENT_GATEWAY',
  parameters: {
    gateway: 'example',
    gatewayMerchantId: 'exampleGatewayMerchantId'
  }
}

// DIRECT：直连解密（自持密钥）
{
  type: 'DIRECT',
  parameters: {
    protocolVersion: 'ECv2',
    publicKey: 'BOdoXP+9Aq473S...'
  }
}
```

---

## 8. 成功回调结果（`onSuccess(result)`）

```js
// Google Pay
{
  method: ('googlePay',
    token, // paymentData.paymentMethodData.tokenizationData.token
    paymentMethodData,
    billingAddress, // 开启账单地址时
    email,
    raw, // 完整 paymentData
    risk, // 见第 6 节；无 enabled 厂商时为 {}
    orderId, // 完整编排模式
    paymentResponse,
    order) // 轮询结束时的状态
}

// Apple Pay
{
  method: ('applePay',
    token, // event.payment.token
    billingContact,
    shippingContact,
    raw, // 完整 event.payment
    risk,
    orderId,
    paymentResponse,
    order)
}
```

---

## 9. 示例集

可交互 demo 见 [`demo/`](../demo/)（`npm run demo`）。各页共用 [`demo/config.js`](../demo/config.js) 中的 gateway / publicKey / payment 等参数。

| PARAMETERS | Demo 页面                                                              |
| ---------- | ---------------------------------------------------------------------- |
| 9.1        | [01-google-pay-gateway.html](../demo/01-google-pay-gateway.html)       |
| 9.2        | [02-google-pay-direct.html](../demo/02-google-pay-direct.html)         |
| 9.3        | [03-google-pay-billing.html](../demo/03-google-pay-billing.html)       |
| 9.4        | [04-google-pay-production.html](../demo/04-google-pay-production.html) |
| 9.5        | [05-apple-pay-basic.html](../demo/05-apple-pay-basic.html)             |
| 9.6        | [06-apple-pay-billing.html](../demo/06-apple-pay-billing.html)         |
| 9.7        | [07-lifecycle.html](../demo/07-lifecycle.html)                         |
| 9.8        | [08-managed-flow.html](../demo/08-managed-flow.html)                   |

### 9.1 Google Pay — 最简（PAYMENT_GATEWAY，TEST）

```js
PaySdk.init({
  method: 'googlePay',
  container: '#pay-container',
  environment: 'TEST',
  payment: { amount: '10.00', currency: 'USD', countryCode: 'US' },
  googlePay: {
    tokenizationSpecification: {
      type: 'PAYMENT_GATEWAY',
      parameters: {
        gateway: 'example',
        gatewayMerchantId: 'exampleGatewayMerchantId'
      }
    }
  },
  onSuccess: (r) => console.log(r.token)
})
```

### 9.2 Google Pay — DIRECT 令牌化

```js
PaySdk.init({
  method: 'googlePay',
  container: '#pay-container',
  environment: 'TEST',
  payment: {
    amount: '25.00',
    currency: 'EUR',
    countryCode: 'DE'
  },
  googlePay: {
    merchantName: 'Demo Merchant',
    tokenizationSpecification: {
      type: 'DIRECT',
      parameters: { protocolVersion: 'ECv2', publicKey: 'BOdoXP+9Aq473S...' }
    }
  },
  onSuccess: (r) => console.log(r.token)
})
```

### 9.3 Google Pay — 需要账单地址

```js
PaySdk.init({
  method: 'googlePay',
  container: '#pay-container',
  environment: 'TEST',
  billingAddressRequired: true,
  payment: { amount: '10.00', currency: 'USD', countryCode: 'US' },
  googlePay: {
    tokenizationSpecification: {
      type: 'PAYMENT_GATEWAY',
      parameters: {
        gateway: 'example',
        gatewayMerchantId: 'exampleGatewayMerchantId'
      }
    }
  },
  onSuccess: (r) => console.log(r.token, r.billingAddress)
})
```

### 9.4 Google Pay — PRODUCTION + 自定义卡组织 + 按钮样式

```js
PaySdk.init({
  method: 'googlePay',
  container: '#pay-container',
  environment: 'PRODUCTION',
  payment: { amount: '99.90', currency: 'USD', countryCode: 'US' },
  googlePay: {
    merchantId: 'BCR2XXXXXXXXXXXXXX',
    merchantName: 'ALCHEMY GPS EUROPE UAB',
    allowedCardNetworks: ['VISA', 'MASTERCARD', 'AMEX'],
    tokenizationSpecification: {
      type: 'PAYMENT_GATEWAY',
      parameters: { gateway: 'stripe', gatewayMerchantId: 'acct_123' }
    },
    button: { buttonColor: 'black', buttonType: 'buy', buttonLocale: 'zh' }
  },
  onSuccess: (r) => console.log(r.token)
})
```

### 9.5 Apple Pay — 最简

```js
PaySdk.init({
  method: 'applePay',
  container: '#pay-container',
  payment: {
    amount: '10.00',
    currency: 'USD',
    countryCode: 'US'
  },
  applePay: {
    validateMerchantUrl: 'https://api-test.alchemytech.cc/pay/apple/domainName/verify'
  },
  onSuccess: (r) => console.log(r.token)
})
```

### 9.6 Apple Pay — 需要账单地址 + 自定义能力/卡组织/按钮

```js
PaySdk.init({
  method: 'applePay',
  container: '#pay-container',
  billingAddressRequired: true,
  payment: {
    amount: '49.00',
    currency: 'GBP',
    countryCode: 'GB'
  },
  applePay: {
    validateMerchantUrl: 'https://api-test.alchemytech.cc/pay/apple/domainName/verify',
    merchantCapabilities: ['supports3DS'],
    supportedNetworks: ['visa', 'masterCard', 'amex'],
    button: { buttonstyle: 'white-outline', type: 'buy', locale: 'zh-CN' }
  },
  onSuccess: (r) => console.log(r.token, r.billingContact)
})
```

### 9.7 完整生命周期（ready → mount → destroy）

```js
const sdk = PaySdk.init({
  method: 'googlePay',
  container: '#pay-container',
  environment: 'TEST',
  payment: { amount: '10.00', currency: 'USD', countryCode: 'US' },
  googlePay: {
    tokenizationSpecification: {
      type: 'PAYMENT_GATEWAY',
      parameters: {
        gateway: 'example',
        gatewayMerchantId: 'exampleGatewayMerchantId'
      }
    }
  },
  onSuccess: (r) => console.log('paid', r.token),
  onError: (e) => console.error(e),
  onCancel: () => console.log('cancelled')
})

sdk
  .ready()
  .then(() => sdk.mount()) // 环境 OK 后再渲染按钮
  .catch((e) => console.warn('不可用：', e.message))

// 需要移除时：
// sdk.destroy()
```

### 9.8 SDK 完整支付编排

使用 `order` + 可选 `environment` / `api`，交互 Mock 示例见
[`08-managed-flow.html`](../demo/08-managed-flow.html)（勾选环境 / 风控 / 账单地址 /
支付结果后，由 `demo/mock-api.js` 返回对应创建订单与支付数据）。`environment` 默认
`PRODUCTION`；传 `TEST` 时 API、Google Pay、Checkout Risk 均走测试侧。四接口默认地址在
[`src/endpoints.ts`](../src/endpoints.ts)。创建订单响应决定钱包类型并下发钱包参数与风控配置。

默认 `actionMode: 'callback'`：二次动作通过 `onAction` 完整吐给商户（含 `MD` /
`JWT` / `action` / `webUrl` / `methodUrl` 等），由商户在 WebView 内打开或经
JS Bridge 授权；SDK **不**强制跳转。轮询在商户处理期间继续。

若设 `actionMode: 'auto'`，或商户调用 `sdk.openAction(action)`，SDK 内置行为为：

- `MD + JWT + action`：390×400 可见 WorldPay challenge iframe，并轮询订单
- `threeDSMethodData + methodUrl`：1px 隐藏 Shift4 method iframe，并轮询订单
- `webUrl` / `s3dsUrl`：当前页面 `location.assign`（整页跳转后轮询自然结束）
