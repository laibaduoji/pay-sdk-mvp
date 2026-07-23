# Pay SDK MVP

An embeddable browser JS SDK that renders an official **Google Pay** or **Apple Pay**
button into a container and returns the payment token to the merchant. Works when
loaded via `<script>` in a browser or an app WebView.

Written in **TypeScript**; bundled to a single IIFE file with Vite.

完整的参数说明（必传/可选）与各场景示例见 [docs/PARAMETERS.md](docs/PARAMETERS.md)。

## Build

```bash
npm install
npm run build      # type-check, bundle dist/pay-sdk.js + copy to demo/pay-sdk.js (for GitHub Pages), emit dist/types/*.d.ts
npm run typecheck  # type-check only (tsc --noEmit)
npm run demo       # build + serve PARAMETERS examples at http://localhost:5173/
npm run format     # prettier write
```

## Demos

示例页在 [`demo/`](demo/)，一一对应 [docs/PARAMETERS.md](docs/PARAMETERS.md) 第 9 节：

| 文件                                                                     | 对应示例                    |
| ------------------------------------------------------------------------ | --------------------------- |
| [demo/index.html](demo/index.html)                                       | 目录页                      |
| [demo/01-google-pay-gateway.html](demo/01-google-pay-gateway.html)       | 9.1 PAYMENT_GATEWAY         |
| [demo/02-google-pay-direct.html](demo/02-google-pay-direct.html)         | 9.2 DIRECT                  |
| [demo/03-google-pay-billing.html](demo/03-google-pay-billing.html)       | 9.3 账单地址                |
| [demo/04-google-pay-production.html](demo/04-google-pay-production.html) | 9.4 PRODUCTION              |
| [demo/05-apple-pay-basic.html](demo/05-apple-pay-basic.html)             | 9.5 Apple Pay 最简          |
| [demo/06-apple-pay-billing.html](demo/06-apple-pay-billing.html)         | 9.6 Apple 账单地址          |
| [demo/07-lifecycle.html](demo/07-lifecycle.html)                         | 9.7 ready → mount → destroy |
| [demo/08-managed-flow.html](demo/08-managed-flow.html)                   | 9.8 完整支付编排            |

共享测试参数写在 [`demo/config.js`](demo/config.js)（`gateway`、`gatewayMerchantId`、`publicKey`、`merchantName`、`validateMerchantUrl`、`payment` 等）。改一处即可让各示例复用。

商户接入最简页（只引入 `pay-sdk.js`，参数写死在页面）：

- [demo/merchant-google-pay.html](demo/merchant-google-pay.html)
- [demo/merchant-apple-pay.html](demo/merchant-apple-pay.html)

## Usage

### Full payment flow

In this mode the SDK creates the order, validates Apple Pay merchants, submits
the wallet token and risk data, and polls order status. Secondary actions
(`webUrl` / 3DS / method / `s3dsUrl`) default to **callback-only** via
`onAction` (WebView-friendly: merchant opens the URL or grants JS Bridge
permission). Set `actionMode: 'auto'` or call `sdk.openAction(action)` to let
the SDK open frames / navigate:

```html
<div id="pay-container"></div>
<script src="./dist/pay-sdk.js"></script>
<script>
  const sdk = PaySdk.init({
    container: '#pay-container',
    order: {
      amount: '10.00',
      currency: 'USD',
      countryCode: 'US'
    },
    api: {
      createOrderUrl: 'https://api.example.com/v1/pay/orders',
      payUrl: 'https://api.example.com/v1/pay/payments',
      queryOrderUrl: 'https://api.example.com/v1/pay/orders/{orderId}',
      headers: () => ({ Authorization: `Bearer ${getAccessToken()}` }),
      pollIntervalMs: 2000,
      pollTimeoutMs: 300000
    },
    // actionMode: 'callback', // default — only notify merchant
    // openAction: async (action) => window.NativeBridge?.open(action),
    onAction(action) {
      // Full fields: MD / JWT / action, webUrl, methodUrl, s3dsUrl, …
      // Merchant opens UI, or after Bridge permission: sdk.openAction(action)
      console.log(action)
    },
    onOrderCreated(order) {
      console.log(order.orderId, order.method)
    },
    onStatusChange(order) {
      console.log(order.status)
    },
    onComplete(result) {
      console.log('flow complete', result.order?.status)
    },
    onSuccess(result) {
      console.log(result.orderId, result.order?.status)
    },
    onError(error) {
      console.error(error)
    }
  })

  sdk.ready().then(() => sdk.mount())
</script>
```

The backend create-order response selects Google Pay or Apple Pay and supplies
the wallet `params`, `risk`, environment, and Apple validation URL. See
[`docs/pay-api/`](docs/pay-api/) for the four HTTP contracts.

### Wallet-only compatibility mode

```html
<div id="pay-container"></div>
<script src="./dist/pay-sdk.js"></script>
<script>
  const sdk = PaySdk.init({
    method: 'googlePay', // 'googlePay' | 'applePay'
    container: '#pay-container',
    environment: 'TEST', // Google Pay: 'TEST' | 'PRODUCTION'
    billingAddressRequired: false,
    payment: {
      amount: '10.00',
      currency: 'USD',
      countryCode: 'US'
    },
    googlePay: {
      merchantName: 'Demo Merchant',
      // merchantId: 'BCR2...',   // required in PRODUCTION
      tokenizationSpecification: {/* see below */},
      button: {
        buttonColor: 'default',
        buttonType: 'plain',
        buttonSizeMode: 'fill'
      }
    },
    applePay: {
      validateMerchantUrl: 'https://api-test.alchemytech.cc/pay/apple/domainName/verify',
      button: { buttonstyle: 'black', type: 'plain', locale: 'en-US' }
    },
    onSuccess(result) {
      console.log(result.token)
    },
    onError(err) {
      console.error(err)
    },
    onCancel() {}
  })

  // Wait until wallet JS is loaded and the environment supports payment,
  // then render the button. This avoids clicks before the SDK is ready.
  sdk
    .ready()
    .then(() => sdk.mount())
    .catch((err) => console.warn('Payment unavailable:', err.message))
</script>
```

## API

| Method                   | Description                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `PaySdk.init(config)`    | Validates full-flow (`order + api`) or wallet-only configuration and returns an SDK instance.                   |
| `sdk.ready()`            | In full-flow mode creates the order first, then loads the selected wallet and checks availability.              |
| `sdk.mount()`            | Renders the wallet button. It may be called before `ready()`; full-flow preparation then runs automatically.    |
| `sdk.openAction(action)` | Opens a secondary action (challenge iframe / method iframe / navigate). Use after merchant / Bridge permission. |
| `sdk.destroy()`          | Clears the button, payment-action iframe and active order polling timer.                                        |

## `tokenizationSpecification` (Google Pay)

Passed through to Google Pay unchanged. Two supported forms:

```js
// DIRECT
{ type: 'DIRECT', parameters: { protocolVersion: 'ECv2', publicKey: '...' } }

// PAYMENT_GATEWAY
{ type: 'PAYMENT_GATEWAY', parameters: { gateway: '...', gatewayMerchantId: '...' } }
```

## Result shape (`onSuccess`)

```js
// Google Pay
{
  method: 'googlePay',
  token: paymentData.paymentMethodData.tokenizationData.token,
  paymentMethodData, billingAddress, email, raw,
  risk // PayRiskPayload；仅 enabled 厂商有字段
}

// Apple Pay
{
  method: 'applePay',
  token: event.payment.token,
  billingContact, shippingContact, raw,
  risk
}
```

把创建订单返回的 `risk` 传给 `PaySdk.init({ risk })`；采集结果在 `onSuccess(result).risk`，再组到支付请求。详见 [docs/PARAMETERS.md](docs/PARAMETERS.md) 第 6 节与 [docs/pay-api/](docs/pay-api/)。

## Billing address

Set `billingAddressRequired: true` to request the billing address on both wallets:

- Google Pay: adds `billingAddressRequired` + `billingAddressParameters.format = 'FULL'`
- Apple Pay: adds `requiredBillingContactFields = ['name', 'postalAddress', 'phone', 'email']`

## Apple Pay domain validation

Apple requires that the merchant session be created **on your server** (never in the
browser). The SDK handles the client half:

1. On button tap the SDK creates an `ApplePaySession` and calls `begin()`.
2. In `onvalidatemerchant`, the SDK `POST`s to your `validateMerchantUrl` with
   `{ validationURL }`.
3. Your server uses its **Merchant Identity Certificate** and Merchant ID to
   request a session from the `validationURL` and returns JSON shaped as
   `{ data: merchantSession }` (Apple's opaque session under `data`).
4. The SDK calls `completeMerchantValidation(merchantSession.data)` and the sheet appears.

Your server / Apple Developer setup (not included in this repo):

- Create a Merchant ID and upload a Merchant Identity Certificate.
- Register and verify every domain that shows the Apple Pay button (host Apple's
  verification file). Domains must be reachable over HTTPS without redirects.
- Implement the `validateMerchantUrl` endpoint that talks to Apple's servers.

Apple Pay only works over HTTPS in Safari on a verified domain; use Google Pay `TEST`
for local development.

## Notes

- Official wallet scripts are loaded at runtime from their CDNs, not bundled:
  Google `https://pay.google.com/gp/p/js/pay.js`,
  Apple `https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js`.
- Type definitions ship in `dist/types/` (config types are exported from the entry).
- MVP does not implement Google Pay dynamic price updates / `PAYMENT_AUTHORIZATION`
  callbacks, shipping, or multi-wallet display.
