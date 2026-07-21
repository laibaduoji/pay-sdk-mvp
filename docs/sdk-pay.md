# 钱包唤起参数参考

直接唤起 **Google Pay** / **Apple Pay** 时使用的原生请求参数。  
标有「需要替换」的字段须换成商户真实值；标有「可选」的字段按业务需要再带上。

---

## 1. Google Pay — DIRECT

`PaymentDataRequest`，令牌化方式为直连解密（自持公钥）。

```js
{
  apiVersion: 2,
  apiVersionMinor: 0,
  allowedPaymentMethods: [
    {
      type: 'CARD',
      parameters: {
        allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
        allowedCardNetworks: ['MASTERCARD', 'VISA'],

        // 可选，需要账单地址时才有
        billingAddressRequired: true,
        billingAddressParameters: {
          format: 'FULL',
          phoneNumberRequired: false
        }
      },
      tokenizationSpecification: {
        type: 'DIRECT',
        parameters: {
          protocolVersion: 'ECv2',
          publicKey: 'your publicKey' // 需要替换
        }
      }
    }
  ],
  transactionInfo: {
    countryCode: 'US', // 需要替换
    currencyCode: 'USD', // 需要替换
    totalPriceStatus: 'FINAL',
    totalPrice: '10.00', // 需要替换
    totalPriceLabel: 'Total'
  },
  merchantInfo: {
    merchantId: 'your merchantId', // 需要替换；TEST 环境可省略，PRODUCTION 必填
    merchantName: 'your merchantName' // 需要替换
  },

  // 可选。不传则 loadPaymentData() 直接返回 paymentData（含 token）。
  // 若传 PAYMENT_AUTHORIZATION，必须同时：
  // 1. 创建 PaymentsClient 时提供 paymentDataCallbacks.onPaymentAuthorized
  // 2. 在回调里调后端处理 token，再 resolve({ transactionState: 'SUCCESS' | 'ERROR' })
  // 否则支付 sheet 会失败或卡住。不需要授权回调时不要带本字段。
  callbackIntents: ['PAYMENT_AUTHORIZATION']
}
```

---

## 2. Google Pay — PAYMENT_GATEWAY

与上一节相同，仅 `tokenizationSpecification` 改为走支付网关。

```js
{
  apiVersion: 2,
  apiVersionMinor: 0,
  allowedPaymentMethods: [
    {
      type: 'CARD',
      parameters: {
        allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
        allowedCardNetworks: ['MASTERCARD', 'VISA'],

        // 可选，需要账单地址时才有
        billingAddressRequired: true,
        billingAddressParameters: {
          format: 'FULL',
          phoneNumberRequired: false
        }
      },
      tokenizationSpecification: {
        type: 'PAYMENT_GATEWAY',
        parameters: {
          gateway: 'your gateway', // 需要替换
          gatewayMerchantId: 'your gatewayMerchantId' // 需要替换
        }
      }
    }
  ],
  transactionInfo: {
    countryCode: 'US', // 需要替换
    currencyCode: 'USD', // 需要替换
    totalPriceStatus: 'FINAL',
    totalPrice: '10.00', // 需要替换
    totalPriceLabel: 'Total'
  },
  merchantInfo: {
    merchantId: 'your merchantId', // 需要替换；TEST 环境可省略，PRODUCTION 必填
    merchantName: 'your merchantName' // 需要替换
  },

  // 可选。不传则 loadPaymentData() 直接返回 paymentData（含 token）。
  // 若传 PAYMENT_AUTHORIZATION，必须同时：
  // 1. 创建 PaymentsClient 时提供 paymentDataCallbacks.onPaymentAuthorized
  // 2. 在回调里调后端处理 token，再 resolve({ transactionState: 'SUCCESS' | 'ERROR' })
  // 否则支付 sheet 会失败或卡住。不需要授权回调时不要带本字段。
  callbackIntents: ['PAYMENT_AUTHORIZATION']
}
```

---

## 3. Apple Pay — PaymentRequest

创建 `ApplePaySession` 时传入的支付请求。

```js
{
  countryCode: 'US', // 需要替换
  currencyCode: 'USD', // 需要替换
  merchantCapabilities: ['supports3DS', 'supportsCredit', 'supportsDebit'],
  supportedNetworks: ['masterCard', 'visa'],
  total: {
    label: 'ALCHEMY GPS EUROPE UAB',
    type: 'final',
    amount: '10.00' // 需要替换
  },
  // 可选，需要账单地址时才有
  requiredBillingContactFields: ['name', 'postalAddress', 'phone', 'email']
}
```

### 商户域名校验

拉起 Apple Pay 时还须在 `onvalidatemerchant` 中请求商户服务端：

```js
const appleMerchantValidationUrl = 'https://your-merchant-validation-url.com' // 需要替换
```

服务端应返回 `{ data: merchantSession }`（Apple 下发的 opaque session 放在 `data` 下），客户端再调用 `completeMerchantValidation(merchantSession.data)`。

---

## 备注

- Google Pay 的 `environment`（`TEST` / `PRODUCTION`）在创建 `PaymentsClient` 时设置，不在上述 `PaymentDataRequest` 内。
- 不使用 `PAYMENT_AUTHORIZATION` 时，可省略 `callbackIntents`，由 `loadPaymentData` 一次性返回 token。
