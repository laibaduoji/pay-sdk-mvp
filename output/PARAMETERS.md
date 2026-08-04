# PaySdk.init 参数说明（商户最终版）

图例：**必传** = 必须提供，否则 `init` 抛错；**条件** = 某种用法下必传。

SDK 编排：**商户已创建订单** → 钱包授权 → 支付 →（需要时）查询。  
`order` 为创建订单**响应**。SDK **不**调创建订单、**不**签名；后续接口带头 `payment-hub-token`。

接入流程见 [SDK.md](./SDK.md)；App 二次动作见 [WEBVIEW.md](./WEBVIEW.md)。

唤起钱包有两种方式（可只选其一，也可同时提供官方按钮与自定义入口）：

- **SDK 渲染官方按钮**：传 `container`，`ready()` 后 `mount()`
- **商户自定义按钮**：可不传 `container`；`ready()` resolve 表示可点击；用户点击时同步调 `pay()`

---

## 1. 顶层参数

| 参数         | 类型                     |  必传  | 默认值     | 说明                                                                    |
| ------------ | ------------------------ | :----: | ---------- | ----------------------------------------------------------------------- |
| `container`  | `string \| HTMLElement`  |  条件  | —          | 使用 `mount()` 时必传；仅自定义按钮 + `pay()` 时可省略                  |
| `order`      | `object`                 | **是** | —          | 创建订单响应；须含 `orderNo` / `paymentScript` / `token`                |
| `api`        | `object`                 |   否   | 内置生产域 | 可传 `headers` / `pollIntervalMs` / `pollTimeoutMs`；**无需** appSecret |
| `onAction`   | `(action) => void`       |   否   | —          | 需二次动作（webUrl / s3ds / threeDS / threeDSMethod）；SDK 不自动打开   |
| `onSuccess`  | `(result) => void`       |   否   | —          | 支付直接成功，或轮询查单到成功态                                        |
| `onComplete` | `(result) => void`       |   否   | —          | 编排结束（含非终态 `s3dsComplete`）                                     |
| `onError`    | `(error: Error) => void` |   否   | —          | API / 钱包失败、查单失败态、超时等                                      |
| `onCancel`   | `() => void`             |   否   | —          | 用户关闭 Google / Apple Pay 钱包 sheet（未完成授权）                    |

### 示例：SDK 渲染官方按钮

```js
const sdk = PaySdk.init({
  container: '#pay-container',
  order: createOrderResponseFromYourServer,
  api: {
    pollIntervalMs: 2000,
    pollTimeoutMs: 300000
  },
  onAction(action) {
    console.log(action)
  },
  onSuccess(result) {
    console.log(result.orderNo, result.order && result.order.orderState)
  },
  onError(error) {
    console.error(error)
  },
  onCancel() {
    console.log('cancelled')
  }
})

sdk.ready().then(function () {
  sdk.mount()
})
```

### 示例：商户自定义按钮

```js
const btn = document.getElementById('pay-now')
btn.disabled = true
btn.textContent = '加载中'

const sdk = PaySdk.init({
  // 可不传 container
  order: createOrderResponseFromYourServer,
  onSuccess(result) {
    console.log(result.orderNo)
  },
  onError(error) {
    console.error(error)
  },
  onCancel() {
    console.log('cancelled')
  },
  onAction(action) {
    console.log(action)
  }
})

// ready() resolve = 可点击通知
sdk
  .ready()
  .then(function () {
    btn.disabled = false
    btn.textContent = '确认'
  })
  .catch(function (err) {
    console.warn(err.message)
  })

// 须在用户点击的同步栈内调用
btn.addEventListener('click', function () {
  sdk.pay()
})
```

实例方法完整说明见 [SDK.md §5](./SDK.md)：`ready` / `mount` / `pay` / `destroy`。

### API 与轮询

API 根域名：`https://api.alchemypay.org`

- 业务成功：`returnCode === '0000'`
- 轮询默认间隔 `2000` ms，最长 `300000` ms（5 分钟）

### 二次动作

出现二次动作时只触发 `onAction`，**不**自动跳转；原页继续轮询。

App 推荐在 `onAction` 调 Bridge：`openPayWebUrl` / `openPayChallenge` / `openPayMethod`（见 [WEBVIEW.md](./WEBVIEW.md)）。  
**不要**在收银台 WebView 内对 `webUrl` / `s3ds` 做整页跳转。

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

| 块         | 采集结果（内部）                | 支付 body 上送字段              | 说明                       |
| ---------- | ------------------------------- | ------------------------------- | -------------------------- |
| `forter`   | `risk.forter.token`             | `businessParams.cookie`         | 可只传 `{ enabled: true }` |
| `checkout` | `risk.checkout.deviceSessionId` | `businessParams.checkoutCookie` | 可覆盖 `publicKey` 等      |
| `worldPay` | `risk.worldPay.sessionId`       | 顶层 `sessionId`                | 至少需要动态 `jwt`         |

---

## 4. 成功回调结果（`onSuccess` / `onComplete`）

```js
{
  orderNo: 'ord_xxx',
  order: { /* 查单结果，如有；可看 orderState */ }
}
```
