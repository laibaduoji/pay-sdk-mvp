# 参数说明文档

`PaySdk.init(config)` 的完整参数说明。图例：**必传** = 必须提供，否则 `init` 抛错；可选 = 不传则使用默认值。

---

## 1. 顶层参数（`config`）

| 参数                     | 类型                        |  必传  | 默认值   | 说明                                           |
| ------------------------ | --------------------------- | :----: | -------- | ---------------------------------------------- |
| `method`                 | `'googlePay' \| 'applePay'` | **是** | —        | 使用哪种支付方式，由商户显式指定               |
| `container`              | `string \| HTMLElement`     | **是** | —        | 按钮渲染容器，CSS 选择器或 DOM 元素            |
| `payment`                | `PaymentConfig`             | **是** | —        | 交易信息，见第 2 节                            |
| `environment`            | `'TEST' \| 'PRODUCTION'`    |   否   | `'TEST'` | 仅 Google Pay 使用；Apple Pay 不区分           |
| `billingAddressRequired` | `boolean`                   |   否   | `false`  | 是否需要账单地址（两端通用），见第 5 节        |
| `googlePay`              | `GooglePayConfig`           | 见说明 | —        | `method === 'googlePay'` 时**必传**，见第 3 节 |
| `applePay`               | `ApplePayConfig`            | 见说明 | —        | `method === 'applePay'` 时**必传**，见第 4 节  |
| `onSuccess`              | `(result) => void`          |   否   | —        | 支付成功回调，返回规范化结果                   |
| `onError`                | `(error: Error) => void`    |   否   | —        | 出错回调                                       |
| `onCancel`               | `() => void`                |   否   | —        | 用户取消回调                                   |

> 说明：`method` 为 `googlePay` 时未提供 `googlePay.tokenizationSpecification` 会抛错；为 `applePay` 时未提供 `applePay.validateMerchantUrl` 会抛错。

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

## 6. `tokenizationSpecification`（Google Pay 必传）

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

## 7. 成功回调结果（`onSuccess(result)`）

```js
// Google Pay
{
  method: ('googlePay',
    token, // paymentData.paymentMethodData.tokenizationData.token
    paymentMethodData,
    billingAddress, // 开启账单地址时
    email,
    raw) // 完整 paymentData
}

// Apple Pay
{
  method: ('applePay',
    token, // event.payment.token
    billingContact,
    shippingContact,
    raw) // 完整 event.payment
}
```

---

## 8. 示例集

可交互 demo 见 [`demo/`](../demo/)（`npm run demo`）。各页共用 [`demo/config.js`](../demo/config.js) 中的 gateway / publicKey / payment 等参数。

| PARAMETERS | Demo 页面                                                              |
| ---------- | ---------------------------------------------------------------------- |
| 8.1        | [01-google-pay-gateway.html](../demo/01-google-pay-gateway.html)       |
| 8.2        | [02-google-pay-direct.html](../demo/02-google-pay-direct.html)         |
| 8.3        | [03-google-pay-billing.html](../demo/03-google-pay-billing.html)       |
| 8.4        | [04-google-pay-production.html](../demo/04-google-pay-production.html) |
| 8.5        | [05-apple-pay-basic.html](../demo/05-apple-pay-basic.html)             |
| 8.6        | [06-apple-pay-billing.html](../demo/06-apple-pay-billing.html)         |
| 8.7        | [07-lifecycle.html](../demo/07-lifecycle.html)                         |

### 8.1 Google Pay — 最简（PAYMENT_GATEWAY，TEST）

```js
PaySdk.init({
  method: 'googlePay',
  container: '#pay-container',
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

### 8.2 Google Pay — DIRECT 令牌化

```js
PaySdk.init({
  method: 'googlePay',
  container: '#pay-container',
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

### 8.3 Google Pay — 需要账单地址

```js
PaySdk.init({
  method: 'googlePay',
  container: '#pay-container',
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

### 8.4 Google Pay — PRODUCTION + 自定义卡组织 + 按钮样式

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

### 8.5 Apple Pay — 最简

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
    validateMerchantUrl: 'https://your-server.com/apple-pay/session'
  },
  onSuccess: (r) => console.log(r.token)
})
```

### 8.6 Apple Pay — 需要账单地址 + 自定义能力/卡组织/按钮

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
    validateMerchantUrl: 'https://your-server.com/apple-pay/session',
    merchantCapabilities: ['supports3DS'],
    supportedNetworks: ['visa', 'masterCard', 'amex'],
    button: { buttonstyle: 'white-outline', type: 'buy', locale: 'zh-CN' }
  },
  onSuccess: (r) => console.log(r.token, r.billingContact)
})
```

### 8.7 完整生命周期（ready → mount → destroy）

```js
const sdk = PaySdk.init({
  method: 'googlePay',
  container: '#pay-container',
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
