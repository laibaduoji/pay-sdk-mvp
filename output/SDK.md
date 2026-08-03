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

不需要 `npm install`。当前正式推荐路径是 script。

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
        environment: 'TEST', // 联调用 TEST；上线用 PRODUCTION 或不传（默认生产）
        order: order,
        onSuccess(result) {
          console.log('支付成功', result.orderNo, result.order && result.order.orderState)
        },
        onError(error) {
          console.error(error.message)
        },
        onCancel() {
          console.log('用户取消')
        },
        onAction(action) {
          // 默认只回调，不自动打开；App 见 WEBVIEW.md
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

完整参数见 [PARAMETERS.md](./PARAMETERS.md)。

---

## 4. 初始化参数（摘要）

| 参数                                 | 类型                     | 必传 | 默认值         | 说明                             |
| ------------------------------------ | ------------------------ | :--: | -------------- | -------------------------------- |
| `container`                          | `string \| HTMLElement`  |  是  | —              | 按钮挂载节点                     |
| `order`                              | `object`                 |  是  | —              | 创建订单响应，须含 `token`       |
| `environment`                        | `'TEST' \| 'PRODUCTION'` |  否  | `'PRODUCTION'` | API / Google Pay / Checkout 环境 |
| `actionMode`                         | `'callback' \| 'auto'`   |  否  | `'callback'`   | 二次动作是否自动打开             |
| `onAction`                           | `(action) => void`       |  否  | —              | webUrl / 3DS 等                  |
| `onSuccess` / `onError` / `onCancel` | function                 |  否  | —              | 成功 / 失败 / 用户取消钱包       |

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

| 环境                 | 根域名                            |
| -------------------- | --------------------------------- |
| `TEST`               | `https://api-test.alchemytech.cc` |
| `PRODUCTION`（默认） | `https://api.alchemypay.org`      |

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

默认 `actionMode: 'callback'`：只触发 `onAction`，**不**自动跳转。

| `action.type`     | App（推荐）                                                 | 纯 H5                         |
| ----------------- | ----------------------------------------------------------- | ----------------------------- |
| `webUrl` / `s3ds` | `NativeBridge.openPayWebUrl(url, redirectUrl, callbackUrl)` | `location.href = url`         |
| `threeDS`         | `openPayChallenge(壳页, payload)`                           | `sdk.openAction` 或自托管壳页 |
| `threeDSMethod`   | `openPayMethod(壳页, payload)`                              | 同上                          |

**App 禁止**对 `webUrl` / `s3ds` 调用 `sdk.openAction`（会整页 `location.assign`）。

完整 Bridge、壳页与关栏流程 → **[WEBVIEW.md](./WEBVIEW.md)**。参考壳页 → [`html/`](./html/)。

---

## 7. 回调与结果

编排成功时一般看 `orderNo`、`order.orderState`；不必再自己调支付接口。

- `onSuccess(result)`：直接成功或查单成功态
- `onComplete(result)`：编排结束（含 `s3dsComplete` 但未必终态）
- `onError(error)`：`error.message` 可读
- `onCancel()`：用户关闭钱包 sheet

---

## 8. 环境与联调

### `TEST`

- 测试 API；Google Pay `TEST`；缺省商户信息时 SDK 可补齐测试默认值

### `PRODUCTION`（默认）

- 生产 API；须使用创建订单下发的真实 Google `merchantId` / 网关配置

### 风控

- Fingerprint：`init` 采集，请求头 `fingerprint-id`
- Forter / Checkout / WorldPay：创建订单 `risk.*.enabled === true` 时在 `ready()` 预采集

---

## 9. 接入检查清单

- [ ] 已引入同目录或 CDN 的 `pay-sdk.js`，页面 HTTPS
- [ ] `container` 存在且可见
- [ ] **服务端**创建订单响应含 `orderNo` / `paymentScript` / `token`
- [ ] `PaySdk.init({ order })` 传入完整响应；联调 `environment: 'TEST'`
- [ ] 实现 `onSuccess` / `onError` / `onCancel`
- [ ] App：按 [WEBVIEW.md](./WEBVIEW.md) 实现 Bridge；`webUrl`/`s3ds` 不要 `sdk.openAction`
- [ ] 创建订单带 `redirectUrl`（及如需的 `callbackUrl`）；回跳后调 `__paySdkSecondaryReturn()`
- [ ] 离开支付页 `sdk.destroy()`，并关闭未关的抽屉
- [ ] 业务接口 `returnCode === '0000'` 联调通过

---

## 10. 常见问题

**Q：必须用 JS Bridge 吗？**  
A：纯 H5 可不接。App 内嵌且要原页继续轮询时，二次动作应走 Bridge。见 [WEBVIEW.md](./WEBVIEW.md)。

**Q：要自己调创建订单、支付接口吗？**  
A：创建订单须商户服务端；支付 / 查单 / Apple 域名校验由 SDK 调用。

**Q：SDK 还要 appSecret / 签名吗？**  
A：否。签名只在服务端创建订单时使用；SDK 用 `token` 作 `payment-hub-token`。

**Q：可以对 webUrl 调 `sdk.openAction` 吗？**  
A：会整页离开，**App 场景禁止**。请用底部抽屉 Bridge。
