# Pay SDK MVP

An embeddable browser JS SDK that runs a full **Google Pay / Apple Pay** payment
flow for merchants: wallet authorize → pay → poll status (create-order is done by
the merchant server). Works when loaded via `<script>` in a browser or an app WebView.

Written in **TypeScript**; bundled to a single IIFE file with Vite.

完整参数说明见 [docs/PARAMETERS.md](docs/PARAMETERS.md)。接口契约见
[docs/pay-api/](docs/pay-api/)。

## Build

```bash
npm install
npm run build      # type-check, bundle dist/pay-sdk.js + copy to demo/pay-sdk.js, emit dist/types/*.d.ts
npm run typecheck  # type-check only
npm run demo       # build + serve demos at http://localhost:5173/
npm run format     # prettier write
```

## Demos

| 文件                                                           | 说明                                                          |
| -------------------------------------------------------------- | ------------------------------------------------------------- |
| [demo/index.html](demo/index.html)                             | 目录页（含四种支付返回 Mock 入口）                            |
| [demo/10-mock-pay-outcome.html](demo/10-mock-pay-outcome.html) | Mock 编排：`?outcome=success\|webUrl\|threeDS\|threeDSMethod` |
| [demo/09-live-api.html](demo/09-live-api.html)                 | 真实 openapi（demo 签名创建订单 → 响应交给 SDK）              |

共享 Mock / 凭据见 [`demo/config.js`](demo/config.js)、[`demo/mock-api.js`](demo/mock-api.js)、
[`demo/signed-api.js`](demo/signed-api.js)（仅 demo 签名）。

## Usage

```html
<div id="pay-container"></div>
<script src="./dist/pay-sdk.js"></script>
<script>
  // Merchant server already created the order (signed). Pass response data here.
  const order = {
    orderNo: 'ord_xxx',
    method: 'googlePay',
    token: 'payment-hub-token-from-create-order',
    paymentScript: {/* Google PaymentDataRequest from create-order */},
    risk: {/* optional */}
  }

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
    onOrderCreated(order) {
      console.log(order.orderNo, order.method)
    },
    onStatusChange(order) {
      console.log(order.orderState)
    },
    onComplete(result) {
      console.log('flow complete', result.order?.orderState)
    },
    onSuccess(result) {
      console.log(result.orderNo, result.order?.orderState)
    },
    onError(error) {
      console.error(error)
    }
  })

  sdk.ready().then(() => sdk.mount())
</script>
```

Built-in API hosts live in [`src/endpoints.ts`](src/endpoints.ts)
(`TEST` → `api-test.alchemytech.cc`, `PRODUCTION` → `api.alchemypay.org`).

**Create-order** is performed by the merchant server (API Sign). Pass the response
(including `token`) to `PaySdk.init({ order })`. The SDK does **not** sign and does
**not** call create-order; verify / pay / detail requests send header
`payment-hub-token: <token>`.

Pass `environment` on `init`; omit `api` URLs unless you need a proxy override.
Init `environment` also drives Google Pay and Checkout Risk (sandbox vs prod).
In Google Pay **TEST**, SDK fills defaults when create-order omits them:
`merchantId=863513232473669406`, `merchantName=Example Merchant`,
`gateway=unlimint`, `gatewayMerchantId=googletest`.
Apple Pay merchant validation URL is built in; if create-order returns
`validateMerchantUrl`, that value takes precedence.

The create-order response selects Google Pay or Apple Pay and supplies wallet
`paymentScript`, `risk`, and `token`. Risk collection starts in `ready()` for
`enabled` vendors; the pay request awaits or reuses that result.

Secondary actions (`webUrl` / 3DS / method / `s3dsUrl`) default to **callback-only**
via `onAction`. Set `actionMode: 'auto'` or call `sdk.openAction(action)` to open
frames / navigate.

## API

| Method                   | Description                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `PaySdk.init(config)`    | Validates `order` (+ optional `environment` / `api`) and returns an SDK instance.                               |
| `sdk.ready()`            | Uses the passed create-order response, starts risk prefetch, loads the selected wallet, checks availability.    |
| `sdk.mount()`            | Renders the wallet button. May be called before `ready()`; preparation then runs automatically.                 |
| `sdk.openAction(action)` | Opens a secondary action (challenge iframe / method iframe / navigate). Use after merchant / Bridge permission. |
| `sdk.destroy()`          | Clears the button, payment-action iframe and active order polling timer.                                        |

## Result shape (`onSuccess`)

```js
// Google Pay
{
  method: 'googlePay',
  token: paymentData.paymentMethodData.tokenizationData.token,
  paymentMethodData, billingAddress, email, raw,
  risk, orderNo, paymentResponse, order
}

// Apple Pay
{
  method: 'applePay',
  token: payment.token,
  billingContact, shippingContact, raw,
  risk, orderNo, paymentResponse, order
}
```

## Docs

- [output/](output/) — **商户最终版交付包**（SDK 文件、接入文档、WebView、3DS 壳页）
- [output/SDK.md](output/SDK.md) — merchant H5 / SDK
- [output/WEBVIEW.md](output/WEBVIEW.md) — App WebView / Bridge
- [docs/pay-api/](docs/pay-api/) — internal API contracts（详细类型）
- [docs/PARAMETERS.md](docs/PARAMETERS.md) — internal full parameter notes（商户见 output/PARAMETERS.md）
