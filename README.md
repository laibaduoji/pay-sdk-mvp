# Pay SDK MVP

An embeddable browser JS SDK that runs a full **Google Pay / Apple Pay** payment
flow for merchants: create order → wallet authorize → pay → poll status. Works when
loaded via `<script>` in a browser or an app WebView.

Written in **TypeScript**; bundled to a single IIFE file with Vite.

完整参数说明见 [docs/PARAMETERS.md](docs/PARAMETERS.md)。四接口契约见
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

| 文件                                                   | 说明                                      |
| ------------------------------------------------------ | ----------------------------------------- |
| [demo/index.html](demo/index.html)                     | 目录页                                    |
| [demo/08-managed-flow.html](demo/08-managed-flow.html) | 完整编排 Mock（勾选环境 / 风控 / 账单等） |

共享 Mock 参数见 [`demo/config.js`](demo/config.js)、[`demo/mock-api.js`](demo/mock-api.js)。

## Usage

```html
<div id="pay-container"></div>
<script src="./dist/pay-sdk.js"></script>
<script>
  const sdk = PaySdk.init({
    container: '#pay-container',
    // omit or 'PRODUCTION' for live; 'TEST' → test API + Google Pay TEST + Checkout sandbox
    environment: 'TEST',
    order: {
      amount: '10.00',
      currency: 'USD',
      countryCode: 'US'
    },
    // optional — defaults from src/endpoints.ts by environment
    api: {
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

Built-in API hosts live in [`src/endpoints.ts`](src/endpoints.ts)
(`TEST` → `api-test.alchemytech.cc`, `PRODUCTION` → `api.alchemypay.org`).
Pass `environment` on `init`; omit `api` URLs unless you need a proxy override.
Init `environment` also drives Google Pay and Checkout Risk (sandbox vs prod).
Apple Pay merchant validation URL is built in; if create-order returns
`validateMerchantUrl`, that value takes precedence.

The create-order response selects Google Pay or Apple Pay and supplies wallet
`params` and `risk`. Risk collection starts **immediately after create-order** for
`enabled` vendors; the pay request awaits or reuses that result.

Secondary actions (`webUrl` / 3DS / method / `s3dsUrl`) default to **callback-only**
via `onAction`. Set `actionMode: 'auto'` or call `sdk.openAction(action)` to open
frames / navigate.

## API

| Method                   | Description                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| `PaySdk.init(config)`    | Validates `order` (+ optional `environment` / `api`) and returns an SDK instance.                               |
| `sdk.ready()`            | Creates the order, starts risk prefetch, loads the selected wallet, checks availability.                        |
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
  risk, orderId, paymentResponse, order
}

// Apple Pay
{
  method: 'applePay',
  token: event.payment.token,
  billingContact, shippingContact, raw,
  risk, orderId, paymentResponse, order
}
```

## Apple Pay domain validation

Apple requires that the merchant session be created **on your server**. The SDK
handles the client half:

1. On button tap the SDK creates an `ApplePaySession` and calls `begin()`.
2. In `onvalidatemerchant`, the SDK `POST`s to the validate-merchant URL with
   `{ orderId, validationURL }` (unified API headers).
3. Your server returns `{ returnCode: '0000', data: merchantSession }`.
4. The SDK extracts `data` and calls `completeMerchantValidation(merchantSession)`.

Your server / Apple Developer setup (not included in this repo):

- Create a Merchant ID and upload a Merchant Identity Certificate.
- Register and verify every domain that shows the Apple Pay button.
- Implement the validate-merchant endpoint that talks to Apple's servers.

## Notes

- Official wallet scripts are loaded at runtime from their CDNs, not bundled:
  Google `https://pay.google.com/gp/p/js/pay.js`,
  Apple `https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js`.
- Type definitions ship in `dist/types/` (config types are exported from the entry).
- MVP does not implement Google Pay dynamic price updates / `PAYMENT_AUTHORIZATION`
  callbacks, shipping, or multi-wallet display.
