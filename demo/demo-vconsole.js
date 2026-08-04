/**
 * Init vConsole once for demo pages (App WebView debugging).
 */
;(function (global) {
  function init() {
    if (global.__paySdkDemoVConsole) return global.__paySdkDemoVConsole
    if (typeof global.VConsole !== 'function') {
      console.warn('[demo] VConsole not loaded')
      return null
    }
    global.__paySdkDemoVConsole = new global.VConsole()
    return global.__paySdkDemoVConsole
  }

  init()
  global.PaySdkDemoVConsole = { init: init }
})(window)
