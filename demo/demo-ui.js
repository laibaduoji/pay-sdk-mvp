/**
 * Shared demo UI helpers (status / output / ready→mount / traceId).
 * Expects #status, #output, #pay-container; optional #trace-id / #trace-copy.
 */
window.PaySdkDemoUI = {
  els() {
    return {
      status: document.getElementById('status'),
      output: document.getElementById('output'),
      traceId: document.getElementById('trace-id'),
      traceCopy: document.getElementById('trace-copy')
    }
  },

  showTraceId(traceId, sdk) {
    const { traceId: el } = this.els()
    if (!el) return
    const value =
      (traceId && String(traceId).trim()) ||
      (sdk && typeof sdk.getLastTraceId === 'function' && sdk.getLastTraceId()) ||
      ''
    el.textContent = value || '—'
    el.dataset.traceId = value || ''
  },

  /**
   * Fetch public IPv4 via ipify. Returns IP string or '' on failure/timeout.
   * @param {{ timeoutMs?: number }} [opts]
   */
  async fetchPublicIp(opts) {
    const timeoutMs = (opts && opts.timeoutMs) || 5000
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
    const timer = controller
      ? setTimeout(function () {
          controller.abort()
        }, timeoutMs)
      : null
    try {
      const response = await fetch('https://api.ipify.org?format=json', {
        signal: controller ? controller.signal : undefined
      })
      if (!response.ok) return ''
      const data = await response.json()
      const ip = data && typeof data.ip === 'string' ? data.ip.trim() : ''
      return ip || ''
    } catch (_) {
      return ''
    } finally {
      if (timer != null) clearTimeout(timer)
    }
  },

  /** Resolve current traceId from dataset or visible text (ignore placeholder). */
  currentTraceId() {
    const { traceId: el } = this.els()
    if (!el) return ''
    const fromData = (el.dataset.traceId || '').trim()
    if (fromData) return fromData
    const text = (el.textContent || '').trim()
    if (!text || text === '—') return ''
    return text
  },

  async copyText(value) {
    if (!value) return false
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      try {
        await navigator.clipboard.writeText(value)
        return true
      } catch (_) {
        /* fall through */
      }
    }
    const ta = document.createElement('textarea')
    ta.value = value
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.top = '0'
    ta.style.left = '0'
    ta.style.width = '1px'
    ta.style.height = '1px'
    ta.style.padding = '0'
    ta.style.border = 'none'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    ta.setSelectionRange(0, value.length)
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch (_) {
      ok = false
    }
    ta.remove()
    return ok
  },

  bindTraceCopy() {
    const { traceCopy } = this.els()
    if (!traceCopy || traceCopy.dataset.bound === '1') return
    traceCopy.dataset.bound = '1'
    const self = this
    traceCopy.addEventListener('click', async () => {
      const value = self.currentTraceId()
      if (!value) {
        const prev = traceCopy.textContent
        traceCopy.textContent = '无可复制'
        setTimeout(() => {
          traceCopy.textContent = prev || '复制'
        }, 1200)
        return
      }
      const ok = await self.copyText(value)
      const prev = traceCopy.textContent
      traceCopy.textContent = ok ? '已复制' : '复制失败'
      setTimeout(() => {
        traceCopy.textContent = prev || '复制'
      }, 1200)
    })
  },

  formatError(error) {
    if (!error) return 'Unknown error'
    const parts = [error.message || String(error)]
    if (error.returnCode) parts.push('returnCode=' + error.returnCode)
    if (error.traceId) parts.push('traceId=' + error.traceId)
    return parts.join(' · ')
  },

  handlers(sdkRef) {
    const self = this
    const { status, output } = this.els()
    this.bindTraceCopy()
    return {
      onSuccess(result) {
        if (status) status.textContent = 'Payment authorized.'
        if (output) output.textContent = JSON.stringify(result, null, 2)
        self.showTraceId(null, sdkRef && sdkRef.current)
      },
      onError(error) {
        if (status) status.textContent = 'Error: ' + self.formatError(error)
        self.showTraceId(error && error.traceId, sdkRef && sdkRef.current)
        if (output) {
          output.textContent = JSON.stringify(
            {
              message: error && error.message,
              returnCode: error && error.returnCode,
              traceId: error && error.traceId,
              status: error && error.status
            },
            null,
            2
          )
        }
      },
      onCancel() {
        if (status) status.textContent = 'Payment cancelled.'
      }
    }
  },

  run(sdk) {
    const self = this
    const { status } = this.els()
    this.bindTraceCopy()
    if (status) status.textContent = 'Checking environment…'
    return sdk
      .ready()
      .then(() => {
        if (status) status.textContent = 'Ready. Tap the button to pay.'
        self.showTraceId(null, sdk)
        sdk.mount()
      })
      .catch((err) => {
        if (status) status.textContent = 'Unavailable: ' + self.formatError(err)
        self.showTraceId(err && err.traceId, sdk)
      })
  }
}
