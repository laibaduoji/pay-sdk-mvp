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
商户服务端签名创建订单 → 拿到 data（含 paymentScript / risk / token）
  → 引入 SDK
  → PaySdk.init({ order: 创建订单响应 })
  → ready()：用传入订单选钱包 → 预采风控 → 检查可用
  → mount()：渲染官方支付按钮
  → 用户点击并授权钱包
  → SDK 提交支付 / 查单（请求头 payment-hub-token = order.token；Fingerprint 走 fingerprint-id）
  → 若无二次动作：onSuccess / onComplete
  → 若有 webUrl / 3DS 等：onAction（默认不自动跳转）+ 后台轮询
  → 轮询到成功/失败：onSuccess 或 onError / onComplete
```

商户须在**服务端**调用创建订单（按 [API Sign](https://alchemypay.readme.io/docs/api-sign) 签名），把响应（含 **`token`**）传入 `PaySdk.init`。  
SDK **不**调用创建订单、**不**签名、**不**需要 `appId` / `appSecret`；后续 domain/verify、alchemy-pay、order/detail 自动带请求头 **`payment-hub-token`**。

钱包类型、令牌化、Forter/Checkout/WorldPay 开关由**创建订单接口响应**决定。  
**Fingerprint** 由 SDK 在 `init` 时用内置默认自动采集，并通过请求头 `fingerprint-id` 带到支付相关 API。

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
      // order = 商户服务端创建订单接口返回的 data（须含 token）
      const order = window.__CREATE_ORDER_DATA__

      const sdk = PaySdk.init({
        container: '#pay-container',
        environment: 'TEST', // 联调用 TEST；上线用 PRODUCTION 或不传（默认生产）
        order: order,
        onSuccess(result) {
          console.log('支付成功', result.orderNo, result.order && result.order.orderState)
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

| 参数              | 类型                     | 必传 | 默认值         | 说明                                                        |
| ----------------- | ------------------------ | :--: | -------------- | ----------------------------------------------------------- |
| `container`       | `string \| HTMLElement`  |  是  | —              | 按钮挂载节点，如 `'#pay-container'`                         |
| `order`           | `object`                 |  是  | —              | **创建订单响应**（见下表），须含 `token`                    |
| `environment`     | `'TEST' \| 'PRODUCTION'` |  否  | `'PRODUCTION'` | 影响 API 地址、Google Pay、Checkout 风控环境                |
| `api`             | `object`                 |  否  | 按环境内置     | headers / 轮询等；接口地址由 SDK 按环境内置；无需 appSecret |
| `actionMode`      | `'callback' \| 'auto'`   |  否  | `'callback'`   | 二次动作是否自动打开，见第 6 节                             |
| `openAction`      | `(action) => boolean?`   |  否  | —              | `auto` 时自定义打开（可接 JS Bridge）                       |
| `onOrderCreated`  | `(order) => void`        |  否  | —              | ready 规范化订单后（订单已由商户创建）                      |
| `onRiskCollected` | `(info) => void`         |  否  | —              | Fingerprint / 订单风控预采集结束                            |
| `onStatusChange`  | `(order) => void`        |  否  | —              | 每次查询订单成功                                            |
| `onAction`        | `(action) => void`       |  否  | —              | 需要打开 webUrl / 3DS 等时                                  |
| `onSuccess`       | `(result) => void`       |  否  | —              | 支付直接成功，或查询到 `succeeded`                          |
| `onComplete`      | `(result) => void`       |  否  | —              | 编排结束（含 `s3dsComplete` 但状态未必终态）                |
| `onError`         | `(error) => void`        |  否  | —              | API / 钱包 / 超时 / 失败                                    |
| `onCancel`        | `() => void`             |  否  | —              | 用户关闭钱包 sheet                                          |

### `order`（创建订单响应）

| 字段                  | 类型                        | 必传 | 说明                                |
| --------------------- | --------------------------- | :--: | ----------------------------------- |
| `orderNo`             | `string`                    |  是  | 平台订单号                          |
| `paymentScript`       | `object`                    |  是  | Google / Apple 原生唤起参数         |
| `token`               | `string`                    |  是  | 后续接口请求头 `payment-hub-token`  |
| `method`              | `'googlePay' \| 'applePay'` |  否  | 可省略；SDK 按 `paymentScript` 推断 |
| `environment`         | `'TEST' \| 'PRODUCTION'`    |  否  | 可覆盖 init 环境                    |
| `risk`                | `object`                    |  否  | 风控开关                            |
| `validateMerchantUrl` | `string`                    |  否  | Apple 域名校验覆盖                  |

创建订单**请求**字段在商户服务端调用 openapi，不传给 SDK。详见 [docs/pay-api/](./pay-api/)。

### `api`（均可选）

接口地址由 SDK 按 `environment` 内置，商户无需配置 URL。SDK **不**使用 `appId` / `appSecret`。

| 字段             | 类型                                  | 默认     | 说明                        |
| ---------------- | ------------------------------------- | -------- | --------------------------- |
| `headers`        | `object` 或 `() => object \| Promise` | 无       | 追加其它自定义头            |
| `pollIntervalMs` | `number`                              | `2000`   | 二次动作后轮询间隔（毫秒）  |
| `pollTimeoutMs`  | `number`                              | `300000` | 轮询最长等待（默认 5 分钟） |

### SDK 内置 API 地址（只读，按环境自动选用）

| 环境                 | 根域名                            |
| -------------------- | --------------------------------- |
| `TEST`               | `https://api-test.alchemytech.cc` |
| `PRODUCTION`（默认） | `https://api.alchemypay.org`      |

| 用途           | 路径                                          | 谁调用         |
| -------------- | --------------------------------------------- | -------------- |
| 创建订单       | `POST {根}/open/api/v4/merchant/order/create` | **商户服务端** |
| 支付           | `POST {根}/payment-hub/alchemy-pay`           | SDK            |
| 查询订单       | `GET {根}/payment-hub/order/detail`           | SDK            |
| Apple 域名校验 | `POST {根}/payment-hub/domain/verify`         | SDK            |

创建订单若返回 `validateMerchantUrl`，SDK 会优先使用响应值。

---

## 5. 实例方法

| 方法                     | 说明                                                                     |
| ------------------------ | ------------------------------------------------------------------------ |
| `PaySdk.init(config)`    | 校验配置并返回实例                                                       |
| `sdk.ready()`            | 使用传入订单、预采风控、加载钱包脚本并检查是否可用；返回 `Promise<true>` |
| `sdk.mount()`            | 渲染支付按钮；可先于 `ready()` 调用                                      |
| `sdk.openAction(action)` | 打开二次动作（跳转 / 3DS iframe / method iframe）                        |
| `sdk.destroy()`          | 移除按钮、清理 iframe 与轮询                                             |

---

## 6. 二次动作与 WebView / JS Bridge

支付后可能返回需用户继续完成的步骤（webUrl、3DS 等）。

**App 内嵌（推荐）**：原收银台 WebView **不离开**，用 Native **底部抽屉**打开 `webUrl`；SDK 继续轮询。完整契约、Bridge 签名与可粘贴代码见：

→ **[App WebView 接入指南（底部抽屉）](./APP-WEBVIEW.md)**（可单独复制给 App 同学）

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

### App 推荐（摘要）

```js
onAction(action) {
  if (action.type === 'webUrl' || action.type === 's3ds') {
    window.NativeBridge.openPayWebUrl(action.url) // 底部抽屉；勿 sdk.openAction
    return
  }
  sdk.openAction(action) // threeDS / threeDSMethod：当前页 iframe
}
onSuccess() {
  window.NativeBridge.closePayWebUrl()
}
onError() {
  window.NativeBridge.closePayWebUrl()
}
```

### 纯 H5（非 App）可整页打开

```js
onAction(action) {
  if (action.type === 'webUrl' || action.type === 's3ds') {
    window.location.href = action.url
  } else {
    sdk.openAction(action)
  }
}
```

SDK 内置 `sdk.openAction` 行为：

- `threeDS`：全屏遮罩 + challenge iframe（POST MD/JWT）
- `threeDSMethod`：隐藏 iframe POST
- `webUrl` / `s3ds`：`location.assign`（**整页离开**，App 场景勿用于这两类）

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
  orderNo: 'ord_xxx',
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
  orderNo: 'ord_xxx',
  paymentResponse: { /* ... */ },
  order: { /* ... */ }
}
```

说明：

- 编排成功时商户一般看 `orderNo`、`order.orderState`，不必再自己拿 token 调支付接口（SDK 已调）
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

- **Fingerprint**：`init` 即用内置默认采集；所有 API 请求头带 `fingerprint-id`（失败则省略，不阻断）
- **Forter / Checkout / WorldPay**：创建订单 `risk.*.enabled === true` 时，创建订单后**立即预采集**并写入支付 body
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
- [ ] **服务端**已创建订单，响应含 `orderNo` / `paymentScript` / `token`
- [ ] `PaySdk.init({ order })` 传入完整创建订单响应
- [ ] 联调使用 `environment: 'TEST'`
- [ ] 实现 `onSuccess` / `onError` / `onCancel`
- [ ] WebView / App：按 [APP-WEBVIEW.md](./APP-WEBVIEW.md) 实现 Bridge 开/关底部抽屉；`webUrl` **不要** `sdk.openAction`
- [ ] 创建订单带好 `redirectUrl`（供二级页回跳识别）
- [ ] 离开支付页时调用 `sdk.destroy()`，并关闭未关的抽屉
- [ ] Apple：域名已校验；Google：测试账号 / 生产商户配置就绪
- [ ] 与支付后台确认接口已按统一响应壳（`returnCode === '0000'`）联调通过

---

## 10. 常见问题

**Q：必须用 JS Bridge 吗？**  
A：纯浏览器 H5 可不接。**App 内嵌且要在原页继续轮询时**，`webUrl`/`s3ds` 必须 Bridge（或等价 Native 开二级页）。见 [APP-WEBVIEW.md](./APP-WEBVIEW.md)。

**Q：要自己调创建订单、支付接口吗？**  
A：**创建订单须商户服务端调用**；支付 / 查单 / Apple 域名校验由 SDK 调用。把创建订单响应（含 `token`）传入 `init` 即可。

**Q：SDK 还要 appSecret / 签名吗？**  
A：否。签名只在商户服务端创建订单时使用。SDK 用创建订单返回的 `token` 作为请求头 `payment-hub-token`。

**Q：npm 安装还是 script？**  
A：商户 H5 / WebView 用 **script**。当前交付形态是单文件 `pay-sdk.js`。

**Q：按钮不出现 / ready 失败？**  
A：看 `ready()` 的 reject 文案（钱包脚本加载失败、当前浏览器不支持、`order` 缺 `token` 等）。

**Q：二次动作来了但页面没反应？**  
A：默认不会自动跳转。App：在 `onAction` 里调 `NativeBridge.openPayWebUrl`；纯 H5：自行跳转或 `sdk.openAction`。详见 [APP-WEBVIEW.md](./APP-WEBVIEW.md)。

**Q：可以对 webUrl 调 `sdk.openAction` 吗？**  
A：会 `location.assign` 整页离开，**App 场景不要用**。App 请用底部抽屉 Bridge。
