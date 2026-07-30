# 创建订单响应约定（给服务端）

本文面向**组装创建订单 `data` 的服务端同学**，只列当前联调需改正项与 Google Pay TEST 通道凭据（对齐 ramp-vue `.env.development`）。

---

## 1. 联调常见错误（必须先改）

| 问题                 | 现状（错）                  | 要求（对）                                                                                       |
| -------------------- | --------------------------- | ------------------------------------------------------------------------------------------------ |
| `paymentScript` 类型 | JSON **字符串**             | JSON **对象**                                                                                    |
| Google Pay 测试环境  | `environment: "PRODUCTION"` | `data.environment` 为 `"TEST"`（也可写在 `paymentScript.environment`，SDK 会提升；**推荐顶层**） |
| `currencyCode`       | `USDC` 等加密货币           | 等于创建订单请求的 **`fiatCurrency`**（如 `"USD"`）                                              |

说明：

- SDK **能**解析字符串形式的 `paymentScript`，但契约要求返回 **object**，禁止服务端再 `JSON.stringify`。
- 钱包侧 `currencyCode` 对齐 H5 / ramp-vue：`orderDetails.fiatCurrency`，**绝不能**填 `cryptoCurrency`。

### 错误片段（勿再下发）

```json
{
  "paymentScript": "{\n  \"currencyCode\": \"USDC\",\n  ...\n}",
  "environment": "PRODUCTION"
}
```

### 正确片段

```json
{
  "environment": "TEST",
  "paymentScript": {
    "transactionInfo": {
      "currencyCode": "USD",
      "totalPrice": "80.00"
    }
  }
}
```

---

## 2. 硬性约定（本次重点）

| 项                                        | 要求                                                      |
| ----------------------------------------- | --------------------------------------------------------- |
| `paymentScript`                           | **必须是 object**（禁止字符串）                           |
| `environment`                             | 测试环境必须 `"TEST"`（影响 Google Pay `PaymentsClient`） |
| Google Pay `transactionInfo.currencyCode` | **`fiatCurrency`**（非法币金额字段同理用 `totalPrice`）   |
| Apple Pay `currencyCode`                  | **`fiatCurrency`**（金额用 `total.amount`）               |

`payWayCode`：`701` = Google Pay，`501` = Apple Pay。

---

## 3. 正确示例（TEST，仅示意本次改动点）

### 3.1 Google Pay（Unlimint / `PAYMENT_GATEWAY`）

```json
{
  "data": {
    "environment": "TEST",
    "paymentScript": {
      "apiVersion": 2,
      "apiVersionMinor": 0,
      "allowedPaymentMethods": [
        {
          "type": "CARD",
          "parameters": {
            "allowedAuthMethods": ["PAN_ONLY", "CRYPTOGRAM_3DS"],
            "allowedCardNetworks": ["MASTERCARD", "VISA"],
            "billingAddressRequired": true,
            "billingAddressParameters": {
              "format": "FULL",
              "phoneNumberRequired": false
            }
          },
          "tokenizationSpecification": {
            "type": "PAYMENT_GATEWAY",
            "parameters": {
              "gateway": "unlimint",
              "gatewayMerchantId": "googletest"
            }
          }
        }
      ],
      "transactionInfo": {
        "countryCode": "US",
        "currencyCode": "USD",
        "totalPriceStatus": "FINAL",
        "totalPrice": "80.00",
        "totalPriceLabel": "Total"
      },
      "merchantInfo": {
        "merchantId": "863513232473669406",
        "merchantName": "Example Merchant"
      }
    }
  }
}
```

> SDK 会把 `callbackIntents` 固定为 `["PAYMENT_AUTHORIZATION"]`，服务端可不下发。

### 3.2 Apple Pay

```json
{
  "data": {
    "environment": "TEST",
    "paymentScript": {
      "countryCode": "US",
      "currencyCode": "USD",
      "merchantCapabilities": ["supports3DS", "supportsCredit", "supportsDebit"],
      "supportedNetworks": ["masterCard", "visa"],
      "total": {
        "label": "ALCHEMY GPS EUROPE UAB",
        "type": "final",
        "amount": "80"
      },
      "requiredBillingContactFields": ["name", "postalAddress", "phone", "email"]
    }
  }
}
```

---

## 4. Google Pay TEST 配置（按通道）

前提：`payWayCode = 701`，且响应中 `environment: "TEST"`。

按订单 **`channelCode`** 选择令牌化方式与凭据：

| 通道                 | channelCode  | 令牌化            | 说明               |
| -------------------- | ------------ | ----------------- | ------------------ |
| **Shift4**           | `google_001` | `DIRECT` / ECv2   | 使用 `direct_*`    |
| **Unlimint（默认）** | 其它非上述   | `PAYMENT_GATEWAY` | `gateway=unlimint` |

### 4.1 Shift4 — `google_001`（DIRECT）

| 字段                             | TEST 值                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------ |
| `merchantInfo.merchantId`        | `12345678901234567890`                                                                     |
| `merchantInfo.merchantName`      | `Example Merchant`                                                                         |
| `tokenizationSpecification.type` | `DIRECT`                                                                                   |
| `parameters.protocolVersion`     | `ECv2`                                                                                     |
| `parameters.publicKey`           | `BE6v5sWsfYnUTgU+21rbWKcCAgPBuN8aR7k3b2tq+UMF6iuwHS1Px3maVxaRdbxUOn1HYuMWQ6Uvhc6/OhXE/p4=` |

```json
{
  "merchantInfo": {
    "merchantId": "12345678901234567890",
    "merchantName": "Example Merchant"
  },
  "tokenizationSpecification": {
    "type": "DIRECT",
    "parameters": {
      "protocolVersion": "ECv2",
      "publicKey": "BE6v5sWsfYnUTgU+21rbWKcCAgPBuN8aR7k3b2tq+UMF6iuwHS1Px3maVxaRdbxUOn1HYuMWQ6Uvhc6/OhXE/p4="
    }
  }
}
```

### 4.2 Unlimint — 默认（PAYMENT_GATEWAY）

| 字段                             | TEST 值              |
| -------------------------------- | -------------------- |
| `merchantInfo.merchantId`        | `863513232473669406` |
| `merchantInfo.merchantName`      | `Example Merchant`   |
| `tokenizationSpecification.type` | `PAYMENT_GATEWAY`    |
| `parameters.gateway`             | `unlimint`           |
| `parameters.gatewayMerchantId`   | `googletest`         |

```json
{
  "merchantInfo": {
    "merchantId": "863513232473669406",
    "merchantName": "Example Merchant"
  },
  "tokenizationSpecification": {
    "type": "PAYMENT_GATEWAY",
    "parameters": {
      "gateway": "unlimint",
      "gatewayMerchantId": "googletest"
    }
  }
}
```

---

## 5. 与 SDK 缺省的关系

当 `environment === "TEST"` 且部分 Google Pay 字段缺失时，SDK 可能补齐：

- `merchantId` → `12345678901234567890`
- `merchantName` → `Example Merchant`
- 缺省 `PAYMENT_GATEWAY` → `gateway=unlimint`，`gatewayMerchantId=googletest`

**服务端仍应按通道完整下发**，不要依赖 SDK 补齐（尤其 Shift4 的 DIRECT，以及 Unlimint 的 `merchantId=863513232473669406`）。

**PRODUCTION 勿使用** `googletest`、`Example Merchant`、测试用 `publicKey` / `merchantId`。

---

## 6. 自检清单

- [ ] `paymentScript` 是 **object**，不是字符串
- [ ] 测试环境 `data.environment === "TEST"`
- [ ] `currencyCode === fiatCurrency`（不是 `cryptoCurrency`）
- [ ] `totalPrice` / `total.amount` 与法币金额一致
- [ ] Google Pay 令牌化字段与 `channelCode`（§4）一致
- [ ] PRODUCTION 未误用 TEST 凭据
