# App WebView 接入指南（底部抽屉打开 webUrl）

面向：**商户 Android / iOS App** 与内嵌收银台 H5。  
可单独复制本文给 App 同学落地。

SDK 默认行为已对齐本流程：`actionMode: 'callback'` 时只回调 `onAction`，**不会**自动打开页面，并继续轮询订单状态。

---

## 1. 目标流程

```text
支付接口返回 webUrl（或轮询中出现 s3dsUrl）
  → SDK onAction({ type: 'webUrl'|'s3ds', url })
  → H5 调 Native Bridge：底部抽屉打开新 WebView(url)
  → 原收银台 WebView 里 SDK 继续 poll order/detail
  → 用户完成后：
       A) 原页 poll 终态 onSuccess / onError → closePayWebUrl()
       B) 二级页导航命中 redirectUrl/callbackUrl → Native dismiss
          → 主 WebView 调 window.__paySdkSecondaryReturn() → SDK 立刻查单
          → 终态同样 onSuccess / onError（落地本身不等于成功）
```

**禁止**在收银台 WebView 内对 `webUrl` / `s3ds` 执行：

- `sdk.openAction(action)`（内部是 `location.assign`，整页离开）
- `window.location = url` / `location.href = url`

---

## 2. 职责划分

| 角色                           | 职责                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| 收银台 WebView（H5 + Pay SDK） | 调钱包、支付、`onAction`、轮询查单、`onSuccess`/`onError`                                   |
| Native App                     | 注入 Bridge；底部抽屉打开/关闭二级 WebView；匹配 `redirectUrl`/`callbackUrl` 关栏并通知原页 |
| 商户服务端                     | 创建订单时填写可识别的 `redirectUrl`（及如需的浏览器态 `callbackUrl`）                      |

---

## 3. Bridge 契约（定稿建议）

### 3.1 挂载名

Android：

```kotlin
webView.addJavascriptInterface(PayJsBridge(), "NativeBridge")
```

H5 使用：`window.NativeBridge`。

若历史已注入 `AndroidBridge`，H5 可兼容：

```js
var bridge = window.NativeBridge || window.AndroidBridge
```

### 3.2 方法（给 `@JavascriptInterface`）

| 方法             | 参数                                                      | 说明                                                          |
| ---------------- | --------------------------------------------------------- | ------------------------------------------------------------- |
| `openPayWebUrl`  | `url`, `redirectUrl`?, `callbackUrl`?（后两参可空字符串） | 底部抽屉加载 **支付 webUrl**；后两参供 Native startsWith 关栏 |
| `closePayWebUrl` | 无参                                                      | 关闭二级抽屉 WebView                                          |

只传字符串，不传整段 action JSON。打开的始终是支付返回的 `webUrl`/`s3ds` URL，**不是** redirect/callback 本身。

伪代码：

```kotlin
class PayJsBridge {
  @JavascriptInterface
  fun openPayWebUrl(url: String, redirectUrl: String, callbackUrl: String) {
    // 主线程：BottomSheet + WebView.loadUrl(url)
    // 保存 redirectUrl/callbackUrl，二级导航 startsWith 命中则 dismiss
    // 并 evaluateJavascript: window.__paySdkSecondaryReturn&&window.__paySdkSecondaryReturn()
  }

  @JavascriptInterface
  fun closePayWebUrl() {
    // 主线程：dismiss 抽屉
  }
}
```

SDK 在 `ready` 后注册 `window.__paySdkSecondaryReturn`：Native 关栏后调用可催原页立刻 `queryOrder`；终态仍走商户 `onSuccess`/`onError`。

### 3.3 哪些 action 走 Bridge

| `action.type`   | H5 做法                                  | App               |
| --------------- | ---------------------------------------- | ----------------- |
| `webUrl`        | `NativeBridge.openPayWebUrl(action.url)` | 底部抽屉打开      |
| `s3ds`          | 同上（同一套 open/close）                | 同上              |
| `threeDS`       | `sdk.openAction(action)`                 | **不需要** Bridge |
| `threeDSMethod` | `sdk.openAction(action)`                 | **不需要** Bridge |

`action` 统一带有 `url` 字段，例如：

```js
{ type: 'webUrl', url: 'https://...', webUrl: 'https://...' }
{ type: 's3ds', url: 'https://...', s3dsUrl: 'https://...' }
```

---

## 4. H5 最小接入（可粘贴）

```js
var bridge = window.NativeBridge || window.AndroidBridge

function canOpenPayWebUrl() {
  return !!(bridge && typeof bridge.openPayWebUrl === 'function')
}

function closePayDrawer() {
  if (bridge && typeof bridge.closePayWebUrl === 'function') {
    bridge.closePayWebUrl()
  }
}

var sdk = PaySdk.init({
  container: '#pay-button',
  environment: 'TEST', // 或 'PRODUCTION'
  order: createOrderResponseData, // 须含 token / paymentScript；创建订单带 redirectUrl
  // actionMode 默认 'callback'，可省略
  onAction: function (action) {
    if (action.type === 'webUrl' || action.type === 's3ds') {
      if (canOpenPayWebUrl()) {
        // 后两参为创建订单的 redirectUrl / callbackUrl，供 Native 匹配关栏
        bridge.openPayWebUrl(action.url, redirectUrl || '', callbackUrl || '')
        return
      }
      // 正式 App：不要对本页 openAction(webUrl)
      console.error('[PaySdk] NativeBridge.openPayWebUrl missing')
      return
    }
    // threeDS / threeDSMethod：当前页 iframe
    sdk.openAction(action)
  },
  onSuccess: function (result) {
    closePayDrawer()
    // 跳转商户成功页…
  },
  onError: function (err) {
    closePayDrawer()
  },
  onCancel: function () {
    // 仅钱包 sheet 取消，与关抽屉无关
  }
})

sdk.ready().then(function () {
  sdk.mount()
})
```

### 无 Bridge 时的 fallback

| 场景             | 建议                                                               |
| ---------------- | ------------------------------------------------------------------ |
| 正式 App WebView | Toast「请升级 App」；**禁止**对本页 `sdk.openAction(webUrl)`       |
| 浏览器调试       | 可临时 `location.href = action.url` 或 `sdk.openAction`（仅 Demo） |

---

## 5. 关闭二级 WebView

两路都建议实现：

### A. 原页轮询终态（主路径）

- `onSuccess` / `onError` → 调 `closePayWebUrl()`
- 与 SDK `GET /payment-hub/order/detail` 结果一致

### B. 二级页命中 redirectUrl / callbackUrl（兜底）

**仅当渠道会浏览器回跳到创建订单的落地地址时启用。** 若渠道不回跳，只依赖路径 A（轮询关抽屉）。

1. 创建订单填写渠道会真实跳回的 `redirectUrl`（及如需的 `callbackUrl`）
2. H5 `openPayWebUrl(webUrl, redirectUrl, callbackUrl)` 把前缀交给 Native
3. Native 监听二级 WebView 导航；`currentUrl.startsWith(redirectUrl|callbackUrl)` → `dismiss` 抽屉
4. Native 在主收银台 WebView 执行 `window.__paySdkSecondaryReturn()`，SDK 立刻查单
5. 落地页可极简；**业务成功仍以查单终态 `onSuccess` 为准**（不要把打开落地页直接当成成功）

匹配建议：`startsWith` 完整前缀（可只比 origin+path）；不要只比 host。

### 用户中途下滑关闭抽屉

| 项             | 建议                                          |
| -------------- | --------------------------------------------- |
| 是否允许       | 产品自定；未完成支付时建议确认或禁止轻易滑关  |
| SDK 轮询       | **继续**（原 WebView 未销毁）                 |
| SDK `onCancel` | **不会**因此触发（`onCancel` 只表示钱包取消） |

---

## 6. Native 实现要点（底部抽屉）

1. `openPayWebUrl` 在**主线程**弹出 BottomSheet / 半屏容器，内嵌独立 WebView。
2. **不要**在收银台 WebView 上 `loadUrl(webUrl)`。
3. 二级 WebView 与主 WebView Cookie 默认隔离；按渠道要求配置第三方 Cookie（若需要）。
4. 同时实现：导航匹配 `redirectUrl`/`callbackUrl` dismiss → 通知 `__paySdkSecondaryReturn` + 接收 H5 `closePayWebUrl`。
5. 收银台页销毁时（Activity finish）务必让 H5 调 `sdk.destroy()`，并关掉未关的抽屉。

---

## 7. 与 SDK 行为对齐（勿踩坑）

| 点                                      | 说明                                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 默认 `callback`                         | 只 `onAction`，不自动开页，然后 **一定继续 poll**                                                             |
| `sdk.openAction(webUrl)`                | **必然** `location.assign`，当前页离开；无开关可关                                                            |
| `actionMode: 'auto'`                    | 可选；若 `config.openAction` 未 `return true`，会回落本页打开。**App 主推仍用 callback + onAction 调 Bridge** |
| 配置项 `openAction` vs `sdk.openAction` | 前者是 init 回调；后者是实例方法，勿混淆                                                                      |

---

## 8. App / H5 自检清单

- [ ] Android 注入 `NativeBridge`，实现三参 `openPayWebUrl` / `closePayWebUrl`
- [ ] 打开形态为**底部抽屉**二级 WebView，非当前页跳转
- [ ] H5：`webUrl`/`s3ds` → Bridge（带 redirect/callback）；`threeDS`/`threeDSMethod` → `sdk.openAction`
- [ ] 创建订单带好 `redirectUrl`，Native startsWith 命中后 dismiss 并调 `__paySdkSecondaryReturn`
- [ ] `onSuccess` / `onError` 调用 `closePayWebUrl`
- [ ] 未对 `webUrl` 调用 `sdk.openAction`
- [ ] 联调时确认原页 Network 仍在轮询 `order/detail`
- [ ] 离开收银台调用 `sdk.destroy()` 并关闭抽屉

---

## 9. FAQ

**Q：必须用 Bridge 吗？**  
纯浏览器 H5 可以整页跳转；**App 内嵌且要保活轮询时必须 Bridge（或等价 Native 开二级页）**。

**Q：只做 redirect 关抽屉、不做 closePayWebUrl？**  
不推荐。轮询失败或无 redirect 时抽屉可能悬空。两路都做。

**Q：Ramp 业务也是整页 `location = webUrl`？**  
是。App 场景不要照搬；本指南是 App 推荐做法。
