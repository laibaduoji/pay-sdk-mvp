# 创建订单响应约定（给服务端）

只列当前联调**需要改正**的项；Google Pay TEST 通道凭据对齐 ramp-vue `.env.development`。

---

## 1. 必须改正

| 问题                    | 现状（错）                           | 要求（对）                                                                                                               |
| ----------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `paymentScript` 类型    | JSON **字符串**                      | JSON **对象**（禁止 `JSON.stringify`）                                                                                   |
| **Google Pay** 测试环境 | `environment: "PRODUCTION"` 或未下发 | `data.environment: "TEST"`（也可写在 `paymentScript.environment`；**推荐顶层**）。Apple Pay **不要**为此加 `environment` |
| `currencyCode`          | `USDC` 等加密货币                    | 等于创建订单请求的 **`fiatCurrency`**（如 `"USD"`）；Google Pay 在 `transactionInfo.currencyCode`                        |

### 错误 → 正确（Google Pay）

```json
// 错
{
  "environment": "PRODUCTION",
  "paymentScript": "{\"transactionInfo\":{\"currencyCode\":\"USDC\",...}}"
}

// 对
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

## 2. Google Pay TEST 通道凭据（需按下单 `channelCode` 改）

前提：`payWayCode = 701`，且 `environment: "TEST"`。

| 通道                 | channelCode  | 令牌化            | 说明               |
| -------------------- | ------------ | ----------------- | ------------------ |
| **Shift4**           | `google_001` | `DIRECT` / ECv2   | 使用 `direct_*`    |
| **Unlimint（默认）** | 其它非上述   | `PAYMENT_GATEWAY` | `gateway=unlimint` |

### Shift4 — `google_001`（DIRECT）

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

### Unlimint — 默认（PAYMENT_GATEWAY）

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

**PRODUCTION 勿使用**上述 TEST 凭据（`googletest` / Example Merchant / 测试 `publicKey` 等）。

---

## 3. 自检

- [ ] `paymentScript` 是 **object**
- [ ] Google Pay：`environment === "TEST"`
- [ ] `currencyCode === fiatCurrency`（不是 crypto）
- [ ] Google Pay 令牌化与 `channelCode` 一致
