/**
 * Shared demo UI helpers (status / output / ready→mount).
 * Expects #status, #output, #pay-container in the page.
 */
window.PaySdkDemoUI = {
  els() {
    return {
      status: document.getElementById('status'),
      output: document.getElementById('output')
    }
  },

  handlers() {
    const { status, output } = this.els()
    return {
      onSuccess(result) {
        if (status) status.textContent = 'Payment authorized.'
        if (output) output.textContent = JSON.stringify(result, null, 2)
      },
      onError(error) {
        if (status)
          status.textContent = 'Error: ' + (error && error.message ? error.message : error)
      },
      onCancel() {
        if (status) status.textContent = 'Payment cancelled.'
      }
    }
  },

  run(sdk) {
    const { status } = this.els()
    if (status) status.textContent = 'Checking environment…'
    return sdk
      .ready()
      .then(() => {
        if (status) status.textContent = 'Ready. Tap the button to pay.'
        sdk.mount()
      })
      .catch((err) => {
        if (status) status.textContent = 'Unavailable: ' + err.message
      })
  }
}
