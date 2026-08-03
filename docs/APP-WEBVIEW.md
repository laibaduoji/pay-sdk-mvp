# App WebView 接入指南（底部抽屉打开 webUrl / 3DS 壳页）

面向：**商户 Android / iOS App** 与内嵌收银台 H5。  
可单独复制本文给 App 同学落地。

SDK 默认行为已对齐本流程：`actionMode: 'callback'` 时只回调 `onAction`，**不会**自动打开页面，并在需二次动作时继续轮询订单状态。

---

## 1. 目标流程

```text
支付接口返回二次动作（webUrl / threeDS / threeDSMethod）
  → 关钱包 sheet 后 SDK onAction
  → H5 调 Native Bridge：底部抽屉打开二级 WebView
       · webUrl / s3ds     → loadUrl(支付 URL)
       · threeDS           → loadUrl(商户 Challenge 壳页) + 注入 payload
       · threeDSMethod     → loadUrl(商户 Method 壳页) + 注入 payload
  → 原收银台 WebView 里 SDK 继续 poll order/detail
  → 轮询中若出现新的 s3dsUrl → 再 onAction(s3ds) → openPayWebUrl 替换抽屉内容
  → 用户完成后：
       A) 原页 poll 终态 onSuccess / onError → closePayWebUrl()
       B) 二级页导航命中 redirectUrl/callbackUrl → Native dismiss
          → 主 WebView 调 window.__paySdkSecondaryReturn() → SDK 立刻查单
          → 终态同样 onSuccess / onError（落地本身不等于成功）
```

无二次动作时：关钱包 sheet 后直接 `onSuccess`（对齐 Ramp，不强制 poll）。

**禁止**在收银台 WebView 内对 `webUrl` / `s3ds` 执行：

- `sdk.openAction(action)`（内部是 `location.assign`，整页离开）
- `window.location = url` / `location.href = url`

App 主推也不要对本页叠 Challenge/Method iframe；用二级抽屉 + 壳页。浏览器 Demo 可 fallback `sdk.openAction`。

---

## 2. 职责划分

| 角色                           | 职责                                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| 收银台 WebView（H5 + Pay SDK） | 调钱包、支付、`onAction`、轮询查单、`onSuccess`/`onError`                                   |
| Native App                     | 注入 Bridge；底部抽屉打开/关闭二级 WebView；壳页注入；匹配 `redirectUrl`/`callbackUrl` 关栏 |
| 商户服务端                     | 创建订单时填写可识别的 `redirectUrl`（及如需的浏览器态 `callbackUrl`）                      |
| 商户 H5                        | 托管 Challenge/Method **参考壳页**（可改名/自托管；也可不用壳页、改用本页 iframe）          |

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

| 方法               | 参数                                                    | 说明                                                                  |
| ------------------ | ------------------------------------------------------- | --------------------------------------------------------------------- |
| `openPayWebUrl`    | `url`, `redirectUrl`, `callbackUrl`（后两参可空字符串） | 抽屉 `loadUrl`（支付 webUrl / s3ds）；后两参供 Native startsWith 关栏 |
| `openPayChallenge` | `shellUrl`, `jsonPayload`                               | 抽屉 `loadUrl(壳页)`，`onPageFinished` 注入 Challenge JSON            |
| `openPayMethod`    | `shellUrl`, `jsonPayload`                               | 同上，Method JSON                                                     |
| `closePayWebUrl`   | 无参                                                    | 关闭二级抽屉 WebView（幂等；Challenge/Method/webUrl 共用）            |

**注意**：不要用同名重载（Android `@JavascriptInterface` 不支持可靠重载）。壳页 URL **由 H5/商户传入**，不要写死在 Native。

伪代码：

```kotlin
class PayJsBridge {
  @JavascriptInterface
  fun openPayWebUrl(url: String, redirectUrl: String, callbackUrl: String) { /* … */ }

  @JavascriptInterface
  fun openPayChallenge(shellUrl: String, jsonPayload: String) {
    // 主线程：BottomSheet + WebView.loadUrl(shellUrl)
    // onPageFinished → evaluateJavascript 调用 __paySdkRenderChallenge(JSON.parse(…))
  }

  @JavascriptInterface
  fun openPayMethod(shellUrl: String, jsonPayload: String) { /* 同上 → __paySdkRenderMethod */ }

  @JavascriptInterface
  fun closePayWebUrl() { /* dismiss 抽屉 */ }
}
```

SDK 在 `ready` 后注册 `window.__paySdkSecondaryReturn`：Native 关栏后调用可催原页立刻 `queryOrder`；终态仍走商户 `onSuccess`/`onError`。

### 3.3 哪些 action 走 Bridge

| `action.type`   | H5 做法（App 推荐）                                                                   | App                 |
| --------------- | ------------------------------------------------------------------------------------- | ------------------- |
| `webUrl`        | `NativeBridge.openPayWebUrl(action.url, redirect, callback)`                          | 底部抽屉 `loadUrl`  |
| `s3ds`          | 同上（同一套 open/close；可替换已打开的抽屉）                                         | 同上                |
| `threeDS`       | `NativeBridge.openPayChallenge(shellUrl, JSON.stringify({MD,JWT,action}))`            | 抽屉加载壳页 + 注入 |
| `threeDSMethod` | `NativeBridge.openPayMethod(shellUrl, JSON.stringify({threeDSMethodData,methodUrl}))` | 同上                |

`action` 统一带有 `url` 字段，例如：

```js
{ type: 'webUrl', url: 'https://...', webUrl: 'https://...' }
{ type: 's3ds', url: 'https://...', s3dsUrl: 'https://...' }
{ type: 'threeDS', url: actionUrl, MD, JWT, action }
{ type: 'threeDSMethod', url: methodUrl, threeDSMethodData, methodUrl }
```

### 3.4 参考壳页（示例，商户可改）

随 Demo 提供（命名/托管域名/是否采用由商户自定）：

| 文件                      | 约定全局函数                                                    | 作用                                  |
| ------------------------- | --------------------------------------------------------------- | ------------------------------------- |
| `demo/3ds-challenge.html` | `window.__paySdkRenderChallenge({ MD, JWT, action })`           | POST MD/JWT → action，iframe ~390×400 |
| `demo/3ds-method.html`    | `window.__paySdkRenderMethod({ threeDSMethodData, methodUrl })` | 隐藏 iframe + form POST Method 字段   |

Native 注入建议：将 `jsonPayload` Base64 后 `evaluateJavascript`，避免引号转义问题。

商户也可继续对本页 `sdk.openAction`（本页 iframe）——**是否使用壳页由商户决定**。

---

## 4. H5 最小接入（可粘贴）

```js
var bridge = window.NativeBridge || window.AndroidBridge
// 商户自配；Demo 可用官方示例相对路径
var challengeShell = 'https://merchant.example/3ds-challenge.html'
var methodShell = 'https://merchant.example/3ds-method.html'

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
        bridge.openPayWebUrl(action.url, redirectUrl || '', callbackUrl || '')
        return
      }
      console.error('[PaySdk] NativeBridge.openPayWebUrl missing')
      return
    }
    if (action.type === 'threeDS') {
      if (bridge && typeof bridge.openPayChallenge === 'function') {
        bridge.openPayChallenge(
          challengeShell,
          JSON.stringify({ MD: action.MD, JWT: action.JWT, action: action.action })
        )
        return
      }
      sdk.openAction(action) // 仅浏览器 fallback
      return
    }
    if (action.type === 'threeDSMethod') {
      if (bridge && typeof bridge.openPayMethod === 'function') {
        bridge.openPayMethod(
          methodShell,
          JSON.stringify({
            threeDSMethodData: action.threeDSMethodData,
            methodUrl: action.methodUrl
          })
        )
        return
      }
      sdk.openAction(action)
    }
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
- Challenge / Method / webUrl **同一** `closePayWebUrl`

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

1. `openPayWebUrl` / `openPayChallenge` / `openPayMethod` 在**主线程**弹出同一 BottomSheet，内嵌独立 WebView。
2. **不要**在收银台 WebView 上 `loadUrl(webUrl)`；**不要**对银行 ACS URL 直接 `loadUrl` 再指望注入 Challenge DOM。
3. Challenge/Method：先 `loadUrl(壳页)`，`onPageFinished` 再注入；换成 s3ds/webUrl 时改为 `loadUrl`，不再注入。
4. 二级 WebView 与主 WebView Cookie 默认隔离；按渠道要求配置第三方 Cookie（若需要）。
5. 同时实现：导航匹配 `redirectUrl`/`callbackUrl` dismiss → 通知 `__paySdkSecondaryReturn` + 接收 H5 `closePayWebUrl`。
6. 收银台页销毁时（Activity finish）务必让 H5 调 `sdk.destroy()`，并关掉未关的抽屉。

---

## 7. 与 SDK 行为对齐（勿踩坑）

| 点                                      | 说明                                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 默认 `callback`                         | 只 `onAction`，不自动开页；有二次动作时 **继续 poll**                                                         |
| 无二次动作                              | 直接 `onSuccess`（不强制 poll）                                                                               |
| `sdk.openAction(webUrl)`                | **必然** `location.assign`，当前页离开；无开关可关                                                            |
| `actionMode: 'auto'`                    | 可选；若 `config.openAction` 未 `return true`，会回落本页打开。**App 主推仍用 callback + onAction 调 Bridge** |
| 配置项 `openAction` vs `sdk.openAction` | 前者是 init 回调；后者是实例方法，勿混淆                                                                      |

---

## 8. App / H5 自检清单

- [ ] Android 注入 `NativeBridge`：`openPayWebUrl` / `openPayChallenge` / `openPayMethod` / `closePayWebUrl`
- [ ] 打开形态为**底部抽屉**二级 WebView，非当前页跳转
- [ ] H5：`webUrl`/`s3ds` → Bridge；`threeDS`/`threeDSMethod` → 壳页 Bridge（或明确选择本页 iframe）
- [ ] 创建订单带好 `redirectUrl`，Native startsWith 命中后 dismiss 并调 `__paySdkSecondaryReturn`
- [ ] `onSuccess` / `onError` 调用 `closePayWebUrl`
- [ ] 未对 `webUrl` 调用 `sdk.openAction`
- [ ] 联调：Method → 可能再出 `s3dsUrl`/`webUrl` 替换抽屉；Challenge → 终态关抽屉
- [ ] 联调时确认原页 Network 仍在轮询 `order/detail`
- [ ] 离开收银台调用 `sdk.destroy()` 并关闭抽屉

---

## 9. FAQ

**Q：必须用 Bridge 吗？**  
纯浏览器 H5 可以整页跳转或本页 iframe；**App 内嵌且要保活轮询时必须 Bridge（或等价 Native 开二级页）**。

**Q：必须用官方壳页 URL 吗？**  
不必。示例页仅供参考；商户可改名、自托管，或不用壳页改用本页 `sdk.openAction`。

**Q：只做 redirect 关抽屉、不做 closePayWebUrl？**  
不推荐。轮询失败或无 redirect 时抽屉可能悬空。两路都做。

**Q：Ramp 业务也是整页 `location = webUrl`？**  
是。App 场景不要照搬；本指南是 App 推荐做法。Challenge/Method 在 Ramp 也是壳页 + iframe，App 把壳页放到二级抽屉即可。
