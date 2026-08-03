# PaySdk.init 参数说明（商户最终版）

图例：**必传** = 必须提供，否则 `init` 抛错。

SDK 编排：**商户已创建订单** → 钱包授权 → 支付 →（需要时）查询。  
`order` 为创建订单**响应**。SDK **不**调创建订单、**不**签名；后续接口带头 `payment-hub-token`。

接入流程见 [SDK.md](./SDK.md)；App 二次动作见 [WEBVIEW.md](./WEBVIEW.md)。

---

## 1. 顶层参数

| 参数             | 类型                     |  必传  | 默认值     | 说明                                                                    |
| ---------------- | ------------------------ | :----: | ---------- | ----------------------------------------------------------------------- |
| `container`      | `string \| HTMLElement`  | **是** | —          | 按钮渲染容器                                                            |
| `order`          | `object`                 | **是** | —          | 创建订单响应；须含 `orderNo` / `paymentScript` / `token`                |
| `api`            | `object`                 |   否   | 内置生产域 | 可传 `headers` / `pollIntervalMs` / `pollTimeoutMs`；**无需** appSecret |
| `onStatusChange` | `(order) => void`        |   否   | —          | 每次查单成功                                                            |
| `onAction`       | `(action) => void`       |   否   | —          | 需二次动作（webUrl / s3ds / threeDS / threeDSMethod）；SDK 不自动打开   |
| `onSuccess`      | `(result) => void`       |   否   | —          | 支付直接成功，或轮询查单到成功态                                        |
| `onComplete`     | `(result) => void`       |   否   | —          | 编排结束（含非终态 `s3dsComplete`）                                     |
| `onError`        | `(error: Error) => void` |   否   | —          | API / 钱包失败、查单失败态、超时等                                      |
| `onCancel`       | `() => void`             |   否   | —          | 用户关闭 Google / Apple Pay 钱包 sheet（未完成授权）                    |

### 示例

```js
const sdk = PaySdk.init({
  container: '#pay-container',
  order: createOrderResponseFromYourServer,
  api: {
    pollIntervalMs: 2000,
    pollTimeoutMs: 300000
  },
  // 需二次动作；App 在此调 Bridge，见 WEBVIEW.md
  onAction(action) {
    console.log(action)
  },
  // 支付直接成功，或轮询查单到成功态
  onSuccess(result) {
    console.log(result.orderNo, result.order && result.order.orderState)
  },
  // API / 钱包失败、查单失败态、超时等
  onError(error) {
    console.error(error)
  },
  // 用户关闭钱包 sheet（未完成授权）
  onCancel() {
    console.log('cancelled')
  }
})

sdk.ready().then(function () {
  sdk.mount()
})
```

### API 与轮询

API 根域名：`https://api.alchemypay.org`

- 业务成功：`returnCode === '0000'`
- 轮询默认间隔 `2000` ms，最长 `300000` ms（5 分钟）

### 二次动作

出现二次动作时只触发 `onAction`，**不**自动跳转；原页继续轮询。

App 推荐在 `onAction` 调 Bridge：`openPayWebUrl` / `openPayChallenge` / `openPayMethod`（见 [WEBVIEW.md](./WEBVIEW.md)）。  
**不要**对 `webUrl` / `s3ds` 调 `sdk.openAction`。

---

## 2. `order`（创建订单响应）

| 参数            | 类型     |  必传  | 说明                         |
| --------------- | -------- | :----: | ---------------------------- |
| `orderNo`       | `string` | **是** | 平台订单号                   |
| `paymentScript` | `object` | **是** | Google / Apple 原生参数      |
| `token`         | `string` | **是** | 请求头 `payment-hub-token`   |
| `risk`          | `object` |   否   | Forter / Checkout / WorldPay |

创建订单**请求**字段由服务端调用 openapi，不传入 SDK。见 [SERVER.md](./SERVER.md)。

---

## 3. `risk`（创建订单下发）

仅 `enabled === true` 的厂商会在 `ready()` 预采集并写入支付 body；失败不阻断支付。

Fingerprint **不在**创建订单下发：SDK `init` 采集，仅请求头 `fingerprint-id`。

| 块         | 支付 body 字段                  | 说明                       |
| ---------- | ------------------------------- | -------------------------- |
| `forter`   | `risk.forter.token`             | 可只传 `{ enabled: true }` |
| `checkout` | `risk.checkout.deviceSessionId` | 可覆盖 `publicKey` 等      |
| `worldPay` | `risk.worldPay.sessionId`       | 至少需要动态 `jwt`         |

---

## 4. 成功回调结果（摘要）

```js
{
  method: 'googlePay' | 'applePay',
  token: '...',
  risk: { /* ... */ },
  orderNo: 'ord_xxx',
  paymentResponse: { /* 支付接口 data */ },
  order: { /* 轮询结束时的查询结果，如有 */ }
  // Google 另有 paymentMethodData / billingAddress / email / raw
  // Apple 另有 billingContact / shippingContact / raw
}
```
