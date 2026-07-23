# Pay SDK 商户接入文档

本文说明商户如何在 **H5 / App WebView** 中接入 Pay SDK，完成 Google Pay / Apple Pay 支付。  
阅读本文即可接入，无需再翻其它文档。

---

## 1. 接入方式

推荐使用 **`<script>` 引入** 构建产物 `pay-sdk.js`（IIFE，挂载到 `window.PaySdk`）。

```html
<script src="https://你的CDN域名/pay-sdk.js"></script>
```

不需要 `npm install`。若商户自有前端工程想打包进 bundle，需另行约定 npm 包发布方式；当前正式推荐路径是 script。

**环境要求：**

- 页面须 **HTTPS**（本地可用 localhost）
- Google Pay / Apple Pay 依赖官方脚本（SDK 运行时从 CDN 加载，无需商户再引）
- Apple Pay：Safari / 已校验域名；Google Pay：支持的浏览器与账号环境

---

## 2. 支付流程（SDK 已编排）

```text
引入 SDK
  → PaySdk.init(config)
  → ready()：创建订单 → 按响应选 Google/Apple → 预采风控 → 检查钱包可用
  → mount()：渲染官方支付按钮
  → 用户点击并授权钱包
  → SDK 提交支付（带 token + 风控）
  → 若无二次动作：onSuccess / onComplete
  → 若有 webUrl / 3DS 等：onAction（默认不自动跳转）+ 后台轮询
  → 轮询到成功/失败：onSuccess 或 onError / onComplete
```

商户 **不必** 自己调创建订单 / 支付 / 查询接口；只需提供金额等业务参数与鉴权 headers（如需要）。  
钱包类型、令牌化、风控开关均由**创建订单接口响应**决定。

---

## 3. 最小接入示例

```html
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Pay</title>
  </head>
  <body>
    <div id="pay-container"></div>
    <script src="https://你的CDN域名/pay-sdk.js"></script>
    <script>
      function getAccessToken() {
        // 商户自行实现：返回调用支付 API 所需的鉴权 token
        return '...'
      }

      const sdk = PaySdk.init({
        container: '#pay-container',
        environment: 'TEST', // 联调用 TEST；上线用 PRODUCTION 或不传（默认生产）
        order: {
          amount: '10.00',
          currency: 'USD',
          countryCode: 'US'
        },
        api: {
          // 可选：默认按 environment 使用内置 API 地址
          headers: () => ({
            Authorization: 'Bearer ' + getAccessToken()
          })
        },
        onSuccess(result) {
          console.log('支付成功', result.orderId, result.order && result.order.status)
          // 跳转商户成功页
        },
        onError(error) {
          console.error(error.message)
          // 展示错误
        },
        onCancel() {
          console.log('用户取消')
        },
        onAction(action) {
          // 默认只回调，不自动打开；见第 6 节
          console.log('二次动作', action)
        }
      })

      sdk
        .ready()
        .then(function () {
          sdk.mount()
        })
        .catch(function (err) {
          console.warn('支付不可用', err.message)
        })
    </script>
  </body>
</html>
```

也可直接 `sdk.mount()`（内部会自动 `ready()`）；推荐先 `ready()` 再 `mount()`，便于处理「当前环境不支持钱包」。

---

## 4. 初始化参数

| 参数             | 类型                     | 必传 | 默认值         | 说明                                         |
| ---------------- | ------------------------ | :--: | -------------- | -------------------------------------------- |
| `container`      | `string \| HTMLElement`  |  是  | —              | 按钮挂载节点，如 `'#pay-container'`          |
| `order`          | `object`                 |  是  | —              | 见下表                                       |
| `environment`    | `'TEST' \| 'PRODUCTION'` |  否  | `'PRODUCTION'` | 影响 API 地址、Google Pay、Checkout 风控环境 |
| `api`            | `object`                 |  否  | 按环境内置     | headers / 轮询 / 覆盖 URL，见下表            |
| `actionMode`     | `'callback' \| 'auto'`   |  否  | `'callback'`   | 二次动作是否自动打开，见第 6 节              |
| `openAction`     | `(action) => boolean?`   |  否  | —              | `auto` 时自定义打开（可接 JS Bridge）        |
| `onOrderCreated` | `(order) => void`        |  否  | —              | 创建订单成功                                 |
| `onStatusChange` | `(order) => void`        |  否  | —              | 每次查询订单成功                             |
| `onAction`       | `(action) => void`       |  否  | —              | 需要打开 webUrl / 3DS 等时                   |
| `onSuccess`      | `(result) => void`       |  否  | —              | 支付直接成功，或查询到 `succeeded`           |
| `onComplete`     | `(result) => void`       |  否  | —              | 编排结束（含 `s3dsComplete` 但状态未必终态） |
| `onError`        | `(error) => void`        |  否  | —              | API / 钱包 / 超时 / 失败                     |
| `onCancel`       | `() => void`             |  否  | —              | 用户关闭钱包 sheet                           |

### `order`

| 字段          | 类型     | 必传 | 说明         |
| ------------- | -------- | :--: | ------------ |
| `amount`      | `string` |  是  | 如 `'10.00'` |
| `currency`    | `string` |  是  | 如 `'USD'`   |
| `countryCode` | `string` |  是  | 如 `'US'`    |

### `api`（均可选）

| 字段                  | 类型                                  | 默认         | 说明                                 |
| --------------------- | ------------------------------------- | ------------ | ------------------------------------ |
| `headers`             | `object` 或 `() => object \| Promise` | 无           | 追加到四接口请求（如 Authorization） |
| `pollIntervalMs`      | `number`                              | `2000`       | 二次动作后轮询间隔（毫秒）           |
| `pollTimeoutMs`       | `number`                              | `300000`     | 轮询最长等待（默认 5 分钟）          |
| `createOrderUrl`      | `string`                              | 见下         | 覆盖创建订单地址                     |
| `payUrl`              | `string`                              | 见下         | 覆盖支付地址                         |
| `queryOrderUrl`       | `string`                              | 见下         | 支持 `{orderId}` 占位                |
| `validateMerchantUrl` | `string`                              | 见下         | 覆盖 Apple 域名校验默认地址          |
| `fetch`               | `typeof fetch`                        | 浏览器 fetch | 自定义请求实现（如 Mock）            |

### 内置 API 地址

| 环境                 | 根域名                            |
| -------------------- | --------------------------------- |
| `TEST`               | `https://api-test.alchemytech.cc` |
| `PRODUCTION`（默认） | `https://api.alchemypay.org`      |

| 用途           | 路径                                    |
| -------------- | --------------------------------------- |
| 创建订单       | `POST {根}/v1/pay/orders`               |
| 支付           | `POST {根}/v1/pay/payments`             |
| 查询订单       | `GET {根}/v1/pay/orders/{orderId}`      |
| Apple 域名校验 | `POST {根}/pay/apple/domainName/verify` |

创建订单若返回 `validateMerchantUrl`，优先用响应值。

---

## 5. 实例方法

| 方法                     | 说明                                                                 |
| ------------------------ | -------------------------------------------------------------------- |
| `PaySdk.init(config)`    | 校验配置并返回实例                                                   |
| `sdk.ready()`            | 创建订单、预采风控、加载钱包脚本并检查是否可用；返回 `Promise<true>` |
| `sdk.mount()`            | 渲染支付按钮；可先于 `ready()` 调用                                  |
| `sdk.openAction(action)` | 打开二次动作（跳转 / 3DS iframe / method iframe）                    |
| `sdk.destroy()`          | 移除按钮、清理 iframe 与轮询                                         |

---

## 6. 二次动作与 WebView / JS Bridge

支付后可能返回需用户继续完成的步骤（webUrl、3DS 等）。

### `action` 载荷形状

```js
// webUrl
{ type: 'webUrl', url: '...', webUrl: '...' }

// WorldPay 等 3DS
{ type: 'threeDS', url: '...', MD: '...', JWT: '...', action: '...' }

// Shift4 等方法页
{ type: 'threeDSMethod', url: '...', threeDSMethodData: '...', methodUrl: '...' }

// 查询过程中的 s3dsUrl
{ type: 's3ds', url: '...', s3dsUrl: '...' }
```

### `actionMode`

| 模式                   | 行为                                                               |
| ---------------------- | ------------------------------------------------------------------ |
| `callback`（**默认**） | 只触发 `onAction`，**不**自动跳转/开窗；适合 App WebView；轮询继续 |
| `auto`                 | 先 `onAction`，再调配置的 `openAction`；未处理则用 SDK 内置打开    |

**JS Bridge 不是必须的。** 仅当 App 需要接管打开页面或控制权限时再接。

#### 模式 A：H5 自己处理（无需 Bridge）

```js
onAction(action) {
  // 例如：当前页跳转、或自建 WebView 容器打开 action.url
  if (action.type === 'webUrl' || action.type === 's3ds') {
    window.location.href = action.url
  } else {
    sdk.openAction(action) // 让 SDK 打开 3DS / method iframe
  }
}
```

#### 模式 B：抛给 Native，再授权 SDK 打开

```js
onAction(action) {
  // 伪代码：把完整 action 交给 App
  window.NativeBridge.postMessage({ type: 'PAY_ACTION', payload: action })
}

// App 处理完权限后回调 H5：
function onNativeAllowOpen(action) {
  sdk.openAction(action)
}
```

#### 模式 C：`actionMode: 'auto'` + Bridge 打开器

```js
PaySdk.init({
  // ...
  actionMode: 'auto',
  openAction(action) {
    if (window.NativeBridge && window.NativeBridge.openPayAction) {
      window.NativeBridge.openPayAction(action)
      return true // 已处理，SDK 不再内置打开
    }
    return false // 回退 SDK 内置
  }
})
```

SDK 内置打开行为：

- `threeDS`：全屏遮罩 + 约 390×400 challenge iframe（POST MD/JWT）
- `threeDSMethod`：隐藏 iframe POST
- `webUrl` / `s3ds`：`location.assign`（整页离开）

---

## 7. 回调与结果

### 成功 / 完成

`onSuccess` / `onComplete` 的 `result` 示例：

```js
// Google Pay
{
  method: 'googlePay',
  token: '...',           // 加密 token 字符串
  paymentMethodData: { /* ... */ },
  billingAddress: { /* 若创建订单要求账单 */ },
  email: '...',
  raw: { /* PaymentData */ },
  risk: { /* 采集到的风控字段 */ },
  orderId: 'ord_xxx',
  paymentResponse: { /* 支付接口 data */ },
  order: { /* 轮询结束时的查询结果，如有 */ }
}

// Apple Pay
{
  method: 'applePay',
  token: { /* Apple Pay payment.token */ },
  billingContact: { /* ... */ },
  shippingContact: { /* ... */ },
  raw: { /* ApplePayPayment */ },
  risk: { /* ... */ },
  orderId: 'ord_xxx',
  paymentResponse: { /* ... */ },
  order: { /* ... */ }
}
```

说明：

- 编排成功时商户一般看 `orderId`、`order.status`，不必再自己拿 token 调支付接口（SDK 已调）
- `onComplete` 在 `s3dsComplete === true` 但状态尚未终态时也可能触发，需结合 `order` 判断

### 错误与取消

- `onError(error)`：`error.message` 为可读文案（含 API `returnMsg`、轮询超时等）
- `onCancel()`：用户关闭钱包，未完成授权

---

## 8. 环境与联调注意

### `environment: 'TEST'`

- 走测试 API 根域名
- Google Pay 使用 `TEST`；缺省商户信息时 SDK 补齐测试默认值（`merchantId` / `gateway` 等）
- Checkout 风控走沙盒 key（创建订单未下发 `publicKey` 时）

### `environment: 'PRODUCTION'`（默认）

- 生产 API 与 Google Pay `PRODUCTION`
- 须使用真实 Google `merchantId`、网关配置等（由创建订单下发）

### 风控

- 创建订单返回的 `risk.*.enabled === true` 时，SDK 在创建订单后**立即预采集**
- 支付时已完成则直接用，进行中则等待；单项失败不阻断支付

### Apple Pay

- 域名须在 Apple Developer 注册并托管校验文件
- 域名校验由 SDK 调服务端接口完成；服务端需用 Merchant Identity 证书向 Apple 换 session

### Google Pay

- SDK 固定使用 `callbackIntents: ['PAYMENT_AUTHORIZATION']`，并在 sheet 打开期间完成支付接口调用

---

## 9. 商户接入检查清单

- [ ] 页面 HTTPS，已引入 `pay-sdk.js`
- [ ] `container` 存在且可见
- [ ] `order.amount / currency / countryCode` 正确
- [ ] 联调使用 `environment: 'TEST'`
- [ ] 若 API 需鉴权，配置 `api.headers`
- [ ] 实现 `onSuccess` / `onError` / `onCancel`
- [ ] WebView 场景实现 `onAction`（或 `auto` + Bridge），避免二次动作无响应
- [ ] 离开支付页时调用 `sdk.destroy()`
- [ ] Apple：域名已校验；Google：测试账号 / 生产商户配置就绪
- [ ] 与支付后台确认四接口已按统一响应壳（`returnCode === '0000'`）联调通过

---

## 10. 常见问题

**Q：必须用 JS Bridge 吗？**  
A：否。默认 `callback` 模式只回调 `onAction`。只有 App 要接管开页/权限时才需要 Bridge。

**Q：要自己调创建订单、支付接口吗？**  
A：否。SDK 会按内置（或你覆盖的）地址调用；商户主要传 `order` 与可选 `headers`。

**Q：npm 安装还是 script？**  
A：商户 H5 / WebView 用 **script**。当前交付形态是单文件 `pay-sdk.js`。

**Q：按钮不出现 / ready 失败？**  
A：看 `ready()` 的 reject 文案（钱包脚本加载失败、当前浏览器不支持、创建订单失败等）。

**Q：二次动作来了但页面没反应？**  
A：默认不会自动跳转。请在 `onAction` 里处理，或设 `actionMode: 'auto'` / 调用 `sdk.openAction(action)`。
