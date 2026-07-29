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

  bindTraceCopy() {
    const { traceCopy, traceId } = this.els()
    if (!traceCopy || traceCopy.dataset.bound === '1') return
    traceCopy.dataset.bound = '1'
    traceCopy.addEventListener('click', async () => {
      const value = (traceId && traceId.dataset.traceId) || ''
      if (!value) return
      try {
        await navigator.clipboard.writeText(value)
        const prev = traceCopy.textContent
        traceCopy.textContent = '已复制'
        setTimeout(() => {
          traceCopy.textContent = prev || '复制'
        }, 1200)
      } catch (_) {
        // fallback
        const ta = document.createElement('textarea')
        ta.value = value
        document.body.appendChild(ta)
        ta.select()
        try {
          document.execCommand('copy')
          traceCopy.textContent = '已复制'
        } catch (_) {}
        ta.remove()
        setTimeout(() => {
          traceCopy.textContent = '复制'
        }, 1200)
      }
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
