# Pay SDK 接入文档（商户最终版）

本文说明商户如何在 **H5 / App WebView** 中接入 Pay SDK，完成 Google Pay / Apple Pay 支付。  
纯 H5 阅读本文即可；**App 内嵌**的 Bridge / 底部抽屉 / 3DS 壳页见 [WEBVIEW.md](./WEBVIEW.md)。

同目录 [`pay-sdk.js`](./pay-sdk.js) 为交付用 SDK 文件。

---

## 1. 接入方式

推荐使用 **`<script>` 引入** `pay-sdk.js`（IIFE，挂载到 `window.PaySdk`）。

```html
<script src="./pay-sdk.js"></script>
<!-- 或 -->
<script src="https://你的CDN域名/pay-sdk.js"></script>
```

**环境要求：**

- 页面须 **HTTPS**
- Google Pay / Apple Pay 依赖官方脚本（SDK 运行时从 CDN 加载，无需商户再引）
- Apple Pay：Safari / 已校验域名；Google Pay：支持的浏览器与账号环境
- **App 内嵌**：Android **8.0+（API 26）**；iOS **16.0+** 且使用 **WKWebView**；主 WebView 与二级抽屉分离。详见 [WEBVIEW.md](./WEBVIEW.md)

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
  → 若有 webUrl / 3DS 等：onAction（不自动跳转）+ 后台轮询
       · App：Native 底部抽屉打开（webUrl / Challenge·Method 壳页）；原页继续 poll
       · 二级页命中 redirectUrl/callbackUrl → Native 关栏 → 主 WebView 调 __paySdkSecondaryReturn() 催查单
  → 轮询到成功/失败：onSuccess 或 onError / onComplete
```

商户须在**服务端**调用创建订单（按 [API Sign](https://alchemypay.readme.io/docs/api-sign) 签名），把响应（含 **`token`**）传入 `PaySdk.init`。详见 [SERVER.md](./SERVER.md)。

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
    <script src="./pay-sdk.js"></script>
    <script>
      // order = 商户服务端创建订单接口返回的 data（须含 token）
      const order = window.__CREATE_ORDER_DATA__

      const sdk = PaySdk.init({
        container: '#pay-container',
        order: order,
        // 支付直接成功，或轮询查单到成功态
        onSuccess(result) {
          console.log('支付成功', result.orderNo, result.order && result.order.orderState)
        },
        // API / 钱包失败、查单失败态、超时等
        onError(error) {
          console.error(error.message)
        },
        // 用户关闭 Google / Apple Pay 钱包 sheet（未完成授权）
        onCancel() {
          console.log('用户取消')
        },
        // 需二次动作（webUrl / s3ds / threeDS / threeDSMethod）；SDK 不自动打开，App 在此调 Bridge
        onAction(action) {
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

完整参数见 [PARAMETERS.md](./PARAMETERS.md)。

---

## 4. 初始化参数（摘要）

| 参数                                 | 类型                    | 必传 | 默认值 | 说明                       |
| ------------------------------------ | ----------------------- | :--: | ------ | -------------------------- |
| `container`                          | `string \| HTMLElement` |  是  | —      | 按钮挂载节点               |
| `order`                              | `object`                |  是  | —      | 创建订单响应，须含 `token` |
| `onAction`                           | `(action) => void`      |  否  | —      | webUrl / 3DS 等二次动作    |
| `onSuccess` / `onError` / `onCancel` | function                |  否  | —      | 成功 / 失败 / 用户取消钱包 |

### `order` 必含字段

| 字段            | 说明                           |
| --------------- | ------------------------------ |
| `orderNo`       | 平台订单号                     |
| `paymentScript` | Google / Apple 原生唤起参数    |
| `token`         | 后续请求头 `payment-hub-token` |

### SDK 内置 API（谁调用）

| 用途           | 路径                                          | 谁调用         |
| -------------- | --------------------------------------------- | -------------- |
| 创建订单       | `POST {根}/open/api/v4/merchant/order/create` | **商户服务端** |
| 支付           | `POST {根}/payment-hub/alchemy-pay`           | SDK            |
| 查询订单       | `GET {根}/payment-hub/order/detail`           | SDK            |
| Apple 域名校验 | `POST {根}/payment-hub/domain/verify`         | SDK            |

API 根域名：`https://api.alchemypay.org`

---

## 5. 实例方法

| 方法                     | 说明                                             |
| ------------------------ | ------------------------------------------------ |
| `PaySdk.init(config)`    | 校验配置并返回实例                               |
| `sdk.ready()`            | 规范化订单、预采风控、检查钱包可用               |
| `sdk.mount()`            | 渲染支付按钮                                     |
| `sdk.openAction(action)` | 打开二次动作（浏览器 fallback；App 主推 Bridge） |
| `sdk.destroy()`          | 移除按钮、清理 iframe 与轮询                     |

---

## 6. 二次动作（摘要）

出现二次动作时只触发 `onAction`，**不**自动跳转；App 在 `onAction` 中走 Native Bridge。

| `action.type`     | App                                                         |
| ----------------- | ----------------------------------------------------------- |
| `webUrl` / `s3ds` | `NativeBridge.openPayWebUrl(url, redirectUrl, callbackUrl)` |
| `threeDS`         | `openPayChallenge(壳页, payload)`                           |
| `threeDSMethod`   | `openPayMethod(壳页, payload)`                              |

**禁止**对 `webUrl` / `s3ds` 调用 `sdk.openAction`（会整页 `location.assign`）。

完整 Bridge、壳页与关栏流程 → **[WEBVIEW.md](./WEBVIEW.md)**。参考壳页 → [`html/`](./html/)。

---

## 7. 回调与结果

编排成功时一般看 `orderNo`、`order.orderState`；不必再自己调支付接口。

- `onSuccess(result)`：支付直接成功，或轮询查单到成功态
- `onComplete(result)`：编排结束（含 `s3dsComplete` 但未必终态）
- `onError(error)`：API / 钱包失败、查单失败态、超时等；`error.message` 可读
- `onCancel()`：用户关闭 Google / Apple Pay 钱包 sheet（未完成授权）
- `onAction(action)`：需二次动作（`webUrl` / `s3ds` / `threeDS` / `threeDSMethod`）；SDK 不自动打开，App 在此调 Bridge

---

## 8. 风控

- Fingerprint：`init` 采集，请求头 `fingerprint-id`
- Forter / Checkout / WorldPay：创建订单 `risk.*.enabled === true` 时在 `ready()` 预采集

---

## 9. 接入检查清单

- [ ] 已引入同目录或 CDN 的 `pay-sdk.js`，页面 HTTPS
- [ ] `container` 存在且可见
- [ ] **服务端**创建订单响应含 `orderNo` / `paymentScript` / `token`
- [ ] `PaySdk.init({ order })` 传入完整响应
- [ ] 实现 `onSuccess` / `onError` / `onCancel` / `onAction`
- [ ] App：按 [WEBVIEW.md](./WEBVIEW.md) 实现 Bridge；`webUrl`/`s3ds` 不要 `sdk.openAction`
- [ ] 创建订单带 `redirectUrl`（及如需的 `callbackUrl`）；回跳后调 `__paySdkSecondaryReturn()`
- [ ] 离开支付页 `sdk.destroy()`，并关闭未关的抽屉
- [ ] 业务接口 `returnCode === '0000'` 联调通过
