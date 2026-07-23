var PaySdk = function(exports) {
  "use strict";
  const GOOGLE_PAY_JS = "https://pay.google.com/gp/p/js/pay.js";
  const APPLE_PAY_JS = "https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js";
  const cache = {};
  function loadScript(src, { crossorigin = false, id, integrity, defer = false } = {}) {
    const cached = cache[src];
    if (cached) return cached;
    const promise = new Promise((resolve, reject) => {
      const existing = document.querySelector(
        id ? `script#${CSS.escape(id)}` : `script[src="${src}"]`
      );
      if (existing) {
        if (existing.dataset.loaded === "true") return resolve();
        existing.addEventListener("load", () => resolve());
        existing.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
        return;
      }
      const script = document.createElement("script");
      if (id) script.id = id;
      script.src = src;
      if (defer) {
        script.defer = true;
      } else {
        script.async = true;
      }
      if (integrity) {
        script.integrity = integrity;
        script.crossOrigin = "anonymous";
      } else if (crossorigin) {
        script.crossOrigin = "anonymous";
      }
      script.addEventListener("load", () => {
        script.dataset.loaded = "true";
        resolve();
      });
      script.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
      document.head.appendChild(script);
    });
    cache[src] = promise;
    return promise;
  }
  function loadGooglePay() {
    var _a, _b;
    if ((_b = (_a = window.google) == null ? void 0 : _a.payments) == null ? void 0 : _b.api) return Promise.resolve();
    return loadScript(GOOGLE_PAY_JS);
  }
  function loadApplePay() {
    return loadScript(APPLE_PAY_JS, { crossorigin: true }).catch(() => {
    });
  }
  function normalizeGoogleResult(paymentData) {
    var _a, _b, _c;
    const tokenizationData = (_a = paymentData == null ? void 0 : paymentData.paymentMethodData) == null ? void 0 : _a.tokenizationData;
    return {
      method: "googlePay",
      token: tokenizationData == null ? void 0 : tokenizationData.token,
      paymentMethodData: paymentData == null ? void 0 : paymentData.paymentMethodData,
      billingAddress: (_c = (_b = paymentData == null ? void 0 : paymentData.paymentMethodData) == null ? void 0 : _b.info) == null ? void 0 : _c.billingAddress,
      email: paymentData == null ? void 0 : paymentData.email,
      raw: paymentData
    };
  }
  function normalizeAppleResult(payment) {
    return {
      method: "applePay",
      token: payment == null ? void 0 : payment.token,
      billingContact: payment == null ? void 0 : payment.billingContact,
      shippingContact: payment == null ? void 0 : payment.shippingContact,
      raw: payment
    };
  }
  function splitName(name) {
    const parts = (name || "").trim().split(/\s+/).filter(Boolean);
    return {
      firstName: parts.shift() || "",
      lastName: parts.join(" ")
    };
  }
  function onlyCompleteBillingAddress(address) {
    const required = [
      address.addressLine1,
      address.city,
      address.state,
      address.zip,
      address.country,
      address.firstName,
      address.lastName
    ];
    return required.every((value) => value.trim().length > 0) ? address : void 0;
  }
  function normalizeGoogleBillingAddress(address, email) {
    if (!address) return void 0;
    const name = splitName(address.name);
    return onlyCompleteBillingAddress({
      addressLine1: address.address1 || "",
      addressLine2: [address.address2, address.address3].filter(Boolean).join(" "),
      city: address.locality || "",
      state: address.administrativeArea || "",
      zip: address.postalCode || "",
      country: address.countryCode || "",
      firstName: name.firstName,
      lastName: name.lastName,
      phone: address.phoneNumber,
      email
    });
  }
  function normalizeAppleBillingAddress(contact) {
    if (!contact) return void 0;
    const lines = contact.addressLines || [];
    return onlyCompleteBillingAddress({
      addressLine1: lines[0] || "",
      addressLine2: lines.slice(1).join(" "),
      city: contact.locality || "",
      state: contact.administrativeArea || "",
      zip: contact.postalCode || "",
      country: contact.countryCode || "",
      firstName: contact.givenName || "",
      lastName: contact.familyName || "",
      phone: contact.phoneNumber || void 0,
      email: contact.emailAddress || void 0
    });
  }
  function normalizeAppleToken(token) {
    return {
      paymentData: token.paymentData,
      paymentMethod: token.paymentMethod,
      transactionIdentifier: token.transactionIdentifier
    };
  }
  function isGoogleCancel(err) {
    return (err == null ? void 0 : err.statusCode) === "CANCELED";
  }
  function toError(err) {
    if (err instanceof Error) return err;
    if (typeof err === "string") return new Error(err);
    try {
      return new Error(JSON.stringify(err));
    } catch {
      return new Error("Unknown error");
    }
  }
  function e(e2, t2) {
    return (Array.isArray(e2) ? e2 : [e2]).map((e3) => function(e4, t3) {
      const n2 = encodeURIComponent;
      return e4.replace(/<[^<>]+>/g, (e5) => "<version>" === e5 ? "3" : "<apiKey>" === e5 ? n2(t3) : "<loaderVersion>" === e5 ? n2(h) : e5);
    }(String(e3), t2));
  }
  function t(e2, t2) {
    O(e2, e2.len + t2.length), e2.arr.set(t2, e2.len), e2.len += t2.length;
  }
  function n(e2) {
    const n2 = function(e3) {
      const t2 = atob(e3), n3 = t2.length, r2 = new Uint8Array(n3);
      for (let o3 = 0; o3 < n3; o3++) r2[o3] = t2.charCodeAt(o3);
      return r2;
    }(e2);
    let o2 = n2;
    try {
      o2 = function(e3, t2, n3) {
        const r2 = () => {
          throw new Error("Invalid data");
        }, o3 = c(e3);
        o3.length < t2.length + 2 && r2();
        for (let c2 = 0; c2 < t2.length; ++c2) g(o3[1 + c2], o3[0]) !== t2[c2] && r2();
        const i2 = 1 + t2.length, a2 = g(o3[i2], o3[0]);
        o3.length < i2 + 1 + a2 + n3 && r2();
        const s2 = i2 + 1 + a2, l2 = s2 + n3, u2 = new ArrayBuffer(o3.length - l2), d2 = new Uint8Array(u2);
        for (let c2 = 0; c2 < d2.length; ++c2) d2[c2] = o3[l2 + c2] ^ o3[s2 + c2 % n3];
        return u2;
      }(n2, false ? ve : ge, me);
    } catch (a2) {
    }
    try {
      return function(e3) {
        const n3 = { len: 0, arr: new Uint8Array(128) }, o3 = c(e3);
        let a2 = 0;
        const s2 = () => (R2(), o3[a2] === C ? l2() : r(o3[a2]) ? u2() : E2(J) ? (a2 += J.length, null) : E2(Q) ? (a2 += Q.length, true) : E2(Z) ? (a2 += Z.length, false) : o3[a2] === X ? d2() : o3[a2] === W ? f2() : h2()), l2 = () => {
          for (n3.len = 0; a2++, o3[a2] !== C; ) {
            if (o3[a2] === V) {
              if (a2++, o3[a2] === G) {
                const e5 = parseInt(b(o3.subarray(a2 + 1, a2 + 5)), 16);
                t(n3, i(String.fromCharCode(e5))), a2 += 4;
                continue;
              }
              const e4 = te[o3[a2]];
              if (e4) {
                m(n3, e4);
                continue;
              }
              return h2();
            }
            if (void 0 === o3[a2]) return h2();
            m(n3, o3[a2]);
          }
          return a2++, b(function(e4) {
            return e4.arr.subarray(0, e4.len);
          }(n3));
        }, u2 = () => {
          const e4 = a2;
          for (; o3[a2] === H || o3[a2] === F || o3[a2] === j || o3[a2] === $ || r(o3[a2]); ) a2++;
          return Number(b(o3.subarray(e4, a2)));
        }, d2 = () => {
          const e4 = [];
          for (a2++; ; ) {
            if (R2(), o3[a2] === Y) {
              a2++;
              break;
            }
            if (e4.length) {
              if (o3[a2] !== U) return h2();
              a2++;
            }
            e4.push(s2());
          }
          return e4;
        }, f2 = () => {
          const e4 = {};
          let t2 = true;
          for (a2++; ; ) {
            if (R2(), o3[a2] === z) {
              a2++;
              break;
            }
            if (!t2) {
              if (o3[a2] !== U) return h2();
              a2++, R2();
            }
            if (o3[a2] !== C) return h2();
            const n4 = l2();
            if (R2(), o3[a2] !== L) return h2();
            a2++, Object.defineProperty(e4, n4, { value: s2(), configurable: true, enumerable: true, writable: true }), t2 = false;
          }
          return e4;
        }, R2 = () => {
          for (; o3[a2] === M || o3[a2] === K || o3[a2] === k || o3[a2] === x; ) a2++;
        }, E2 = (e4) => {
          for (let t2 = 0; t2 < e4.length; t2++) if (o3[a2 + t2] !== e4[t2]) return false;
          return true;
        }, h2 = () => {
          throw new SyntaxError("Unexpected " + (a2 < o3.length ? `byte ${a2}` : "end"));
        }, p2 = s2();
        R2(), void 0 !== o3[a2] && h2();
        return p2;
      }(o2);
    } catch (s2) {
    }
    return null;
  }
  function r(e2) {
    return e2 >= B && e2 < B + 10 || e2 === q;
  }
  function o(e2, t2) {
    !function(e3, t3, n2) {
      if (Ie((t4) => {
        !function(e4, t5) {
          pe(e4, "", -1, t5);
        }(e3, t4);
      }), n2 < 0) ;
      Ie((r2) => (pe(e3, t3, n2, r2), function(e4) {
        return v(() => {
          const t4 = `${e4}=`;
          for (const e5 of document.cookie.split(";")) {
            let n3 = 0;
            for (; " " === e5[n3] && n3 < e5.length; ) ++n3;
            if (e5.indexOf(t4) === n3) return e5.slice(n3 + t4.length);
          }
        }, void 0);
      }(e3) === t3));
    }(t2, e2, 365), function(e3, t3) {
      var n2;
      try {
        null === (n2 = null === localStorage || void 0 === localStorage ? void 0 : localStorage.setItem) || void 0 === n2 || n2.call(localStorage, e3, t3);
      } catch (r2) {
      }
    }(t2, e2);
  }
  function i(e2) {
    const t2 = new Uint8Array(e2.length);
    for (let n2 = 0; n2 < e2.length; n2++) {
      const r2 = e2.charCodeAt(n2);
      if (r2 > 127) return new TextEncoder().encode(e2);
      t2[n2] = r2;
    }
    return t2;
  }
  function c(e2) {
    return e2 instanceof ArrayBuffer ? new Uint8Array(e2) : new Uint8Array(e2.buffer, e2.byteOffset, e2.byteLength);
  }
  function a({ level: e2, message: t2 }) {
    "error" === e2 ? console.error(t2) : "warning" === e2 ? console.warn(t2) : console.log(t2);
  }
  const s = "Client timeout", l = "Network connection error", u = "Network request aborted", d = "Response cannot be parsed", f = "Blocked by CSP", R = "The endpoint parameter is not a valid URL", E = "Handle on demand agent data error";
  var h = "3.12.13";
  const p = "Failed to load the JS script of the agent", _ = "9319";
  function O(e2, t2) {
    if (e2.arr.length < t2) {
      const n2 = new Uint8Array(Math.max(2 * e2.arr.length, t2));
      n2.set(e2.arr), e2.arr = n2;
    }
  }
  const I = "https://fpnpmcdn.net/v<version>/<apiKey>/loader_v<loaderVersion>.js", w = I;
  function g(e2, t2) {
    return (e2 - t2 + 256) % 256;
  }
  function v(e2, t2) {
    try {
      document.cookie;
    } catch (n2) {
      if (function(e3) {
        if (!(e3 instanceof DOMException)) return false;
        const t3 = e3.message;
        return Re.test(t3) || Ee.test(t3) || he.test(t3);
      }(n2)) return t2;
      throw n2;
    }
    return e2();
  }
  function m(e2, t2) {
    O(e2, e2.len + 1), e2.arr[e2.len++] = t2;
  }
  function y(e2) {
    const t2 = function(e3) {
      const t3 = [...e3];
      return { current: () => t3[0], postpone() {
        const e4 = t3.shift();
        void 0 !== e4 && t3.push(e4);
      }, exclude() {
        t3.shift();
      } };
    }(e2), n2 = /* @__PURE__ */ function(e3, t3) {
      let n3 = 0;
      return () => Math.random() * Math.min(t3, e3 * Math.pow(2, n3++));
    }(100, 3e3), r2 = /* @__PURE__ */ new Set();
    return [t2.current(), (e3, o2) => {
      let i2;
      const c2 = o2 instanceof Error ? o2.message : "";
      if (c2 === f || c2 === R) t2.exclude(), i2 = 0;
      else if (c2 === _) t2.exclude();
      else if (c2 === p) {
        const n3 = Date.now() - e3.getTime() < 50, o3 = t2.current();
        o3 && n3 && !r2.has(o3) && (r2.add(o3), i2 = 0), t2.postpone();
      } else t2.postpone();
      const a2 = t2.current();
      return void 0 === a2 ? void 0 : [a2, null != i2 ? i2 : e3.getTime() + n2() - Date.now()];
    }];
  }
  function T(e2, t2, ...n2) {
    e2 && async function(e3, t3) {
      try {
        return await e3();
      } catch (n3) {
        return console.error(n3), t3;
      }
    }(() => {
      const r2 = t2(...n2);
      void 0 !== r2 && e2(r2);
    });
  }
  const A = { default: "endpoint" }, N = { default: "tlsEndpoint" }, S = "_vid";
  function D(e2, t2, n2, r2) {
    const o2 = document, i2 = "securitypolicyviolation";
    let c2;
    const a2 = (t3) => {
      const n3 = new URL(e2, location.href), { blockedURI: r3 } = t3;
      r3 !== n3.href && r3 !== n3.protocol.slice(0, -1) && r3 !== n3.origin || (c2 = t3, s2());
    };
    o2.addEventListener(i2, a2);
    const s2 = () => o2.removeEventListener(i2, a2);
    return Promise.resolve().then(t2).then((e3) => (s2(), e3), (e3) => new Promise((e4) => {
      const t3 = new MessageChannel();
      t3.port1.onmessage = () => e4(), t3.port2.postMessage(null);
    }).then(() => {
      if (s2(), c2) return n2(c2);
      throw e3;
    }));
  }
  function b(e2) {
    if ("function" == typeof TextDecoder) {
      const t3 = new TextDecoder().decode(e2);
      if (t3) return t3;
    }
    const t2 = c(e2);
    return decodeURIComponent(escape(String.fromCharCode.apply(null, t2)));
  }
  function P(t2) {
    var n2, r2;
    const { picked: o2, rest: i2 } = function(e2, t3) {
      const n3 = {}, r3 = {};
      for (const [o3, i3] of Object.entries(e2)) t3.includes(o3) ? n3[o3] = i3 : r3[o3] = i3;
      return { picked: n3, rest: r3 };
    }(t2, ["scriptUrlPattern", "token", "apiKey"]), c2 = o2.token, a2 = null !== (n2 = o2.apiKey) && void 0 !== n2 ? n2 : c2, s2 = null !== (r2 = function(e2, t3) {
      return Object.prototype.hasOwnProperty.call(e2, t3);
    }(l2 = t2, u2 = "scriptUrlPattern") ? l2[u2] : void 0) && void 0 !== r2 ? r2 : I;
    var l2, u2;
    const [d2, f2] = function() {
      const e2 = [], t3 = () => {
        e2.push({ time: /* @__PURE__ */ new Date(), state: document.visibilityState });
      }, n3 = (r3 = document, o3 = "visibilitychange", i3 = t3, r3.addEventListener(o3, i3, c3), () => r3.removeEventListener(o3, i3, c3));
      var r3, o3, i3, c3;
      return t3(), [e2, n3];
    }();
    return Promise.resolve().then(() => {
      if (!a2 || "string" != typeof a2) throw new Error("API key required");
      return function(e2, t3) {
        const n3 = [], r3 = 5, [o3, i3] = y(e2);
        let c3;
        if (void 0 === o3) return Promise.reject(new TypeError("The list of script URL patterns is empty"));
        const a3 = (e3) => {
          const o4 = /* @__PURE__ */ new Date(), s3 = (t4) => n3.push({ url: e3, startedAt: o4, finishedAt: /* @__PURE__ */ new Date(), error: t4 }), l3 = t3(e3);
          return l3.then(() => s3(), s3), l3.catch((e4) => {
            if (null != c3 || (c3 = e4), n3.length >= r3) throw c3;
            const t4 = i3(o4, e4);
            if (!t4) throw c3;
            const [s4, l4] = t4;
            return (u3 = l4, new Promise((e5) => setTimeout(e5, u3))).then(() => a3(s4));
            var u3;
          });
        };
        return a3(o3).then((e3) => [e3, n3]);
      }(e(s2, a2), _e);
    }).catch((e2) => {
      throw f2(), function(e3) {
        return e3 instanceof Error && e3.message === _ ? new Error(p) : e3;
      }(e2);
    }).then(([e2, t3]) => (f2(), e2.load({ ...i2, ldi: { attempts: t3, visibilityStates: d2 } })));
  }
  const C = 34, U = 44, L = 58, M = 32, x = 9, k = 13, K = 10, V = 92, B = 48, F = 101, G = 117, j = 69, $ = 43, q = 45, H = 46, X = 91, Y = 93, W = 123, z = 125, J = /* @__PURE__ */ new Uint8Array([110, G, 108, 108]), Q = /* @__PURE__ */ new Uint8Array([116, 114, G, F]), Z = /* @__PURE__ */ new Uint8Array([102, 97, 108, 115, F]), ee = { '"': '"', "\\": "\\", "\b": "b", "\f": "f", "\n": "n", "\r": "r", "	": "t" }, te = /* @__PURE__ */ (() => {
    const e2 = new Uint8Array(128);
    for (const [t2, n2] of Object.entries(ee)) e2[n2.charCodeAt(0)] = t2.charCodeAt(0);
    return e2;
  })(), ne = /* @__PURE__ */ Oe("WrongRegion"), re = /* @__PURE__ */ Oe("SubscriptionNotActive"), oe = /* @__PURE__ */ Oe("UnsupportedVersion"), ie = /* @__PURE__ */ Oe("InstallationMethodRestricted"), ce = /* @__PURE__ */ Oe("HostnameRestricted"), ae = /* @__PURE__ */ Oe("IntegrationFailed"), se = /* @__PURE__ */ Oe("NetworkRestricted"), le = /* @__PURE__ */ Oe("InvalidProxyIntegrationSecret"), ue = /* @__PURE__ */ Oe("InvalidProxyIntegrationHeaders"), de = /* @__PURE__ */ Oe("ProxyIntegrationSecretEnvironmentMismatch");
  function fe(e2) {
    return new Promise((t2, n2) => {
      if (function(e3) {
        if (!URL.prototype) return;
        try {
          return new URL(e3, location.href), false;
        } catch (t3) {
          if (t3 instanceof Error && "TypeError" === t3.name) return true;
          throw t3;
        }
      }(e2)) throw new Error(R);
      const r2 = document.createElement("script"), o2 = () => {
        var e3;
        return null === (e3 = r2.parentNode) || void 0 === e3 ? void 0 : e3.removeChild(r2);
      }, i2 = document.head || document.getElementsByTagName("head")[0];
      r2.onload = () => {
        o2(), t2();
      }, r2.onerror = () => {
        o2(), n2(new Error(p));
      }, r2.async = true, r2.src = e2, i2.appendChild(r2);
    });
  }
  const Re = /The document is sandboxed and lacks the 'allow-same-origin' flag/, Ee = /The operation is insecure/, he = /Forbidden in a sandboxed document without the 'allow-same-origin' flag/;
  function pe(e2, t2, n2, r2) {
    v(() => {
      const o2 = `${e2}=${t2}`, i2 = `expires=${new Date(Date.now() + 24 * n2 * 60 * 60 * 1e3).toUTCString()}`, c2 = r2 ? `domain=${r2}` : "";
      document.cookie = [o2, "path=/", i2, c2, "SameSite=Lax"].join("; ");
    }, void 0);
  }
  function _e(e2) {
    return D(e2, () => fe(e2), () => {
      throw new Error(f);
    }).then(we);
  }
  function Oe(e2) {
    let t2 = "";
    for (let n2 = 0; n2 < e2.length; ++n2) if (n2 > 0) {
      const r2 = e2[n2].toLowerCase();
      r2 !== e2[n2] ? t2 += ` ${r2}` : t2 += e2[n2];
    } else t2 += e2[n2].toUpperCase();
    return t2;
  }
  function Ie(e2) {
    const t2 = location.hostname, n2 = function() {
      var e3, t3;
      const n3 = window;
      return ["buildID" in navigator, "MozAppearance" in (null !== (t3 = null === (e3 = document.documentElement) || void 0 === e3 ? void 0 : e3.style) && void 0 !== t3 ? t3 : {}), "onmozfullscreenchange" in n3, "mozInnerScreenX" in n3, "CSSMozDocumentRule" in n3, "CanvasCaptureMediaStream" in n3].reduce((e4, t4) => e4 + (t4 ? 1 : 0), 0) >= 4;
    }();
    (function(e3, t3) {
      let n3 = e3.length - ("." === e3.slice(-1) ? 1 : 0);
      do {
        if (n3 = n3 > 0 ? e3.lastIndexOf(".", n3 - 1) : -1, true === t3(e3.slice(n3 + 1))) return true;
      } while (n3 >= 0);
      return false;
    })(t2, (r2) => {
      if (!n2 || !/^([^.]{1,3}\.)*[^.]+\.?$/.test(r2) || r2 === t2) return e2(r2);
    }) || e2();
  }
  function we() {
    const e2 = window, t2 = "__fpjs_p_l_b", n2 = e2[t2];
    if (function(e3, t3) {
      var n3;
      const r2 = null === (n3 = Object.getOwnPropertyDescriptor) || void 0 === n3 ? void 0 : n3.call(Object, e3, t3);
      (null == r2 ? void 0 : r2.configurable) ? delete e3[t3] : r2 && !r2.writable || (e3[t3] = void 0);
    }(e2, t2), "function" != typeof (null == n2 ? void 0 : n2.load)) throw new Error(_);
    return n2;
  }
  const ge = [3, 13], ve = [3, 14], me = 9;
  const ye = function(e2, t2 = {}) {
    const { storageKey: r2 = S, do: i2 } = t2;
    try {
      const t3 = n(e2);
      null !== t3 ? (t3.visitorToken && o(t3.visitorToken, `${r2}_t`), null == (c2 = t3.notifications) || c2.forEach(a), T(i2, () => ({ e: 25, result: { response: t3 } }))) : T(i2, () => ({ e: 25, result: { error: new Error("Failed to decode response") } }));
    } catch (s2) {
      throw T(i2, () => ({ e: 25, result: { error: s2 instanceof Error ? s2 : new Error(String(s2)) } })), function(e3, t3, n2) {
        const r3 = new Error(e3);
        void 0 !== n2 && (r3.raw = n2);
        return r3;
      }(E, void 0, s2);
    }
    var c2;
  }, Te = "API key required", Ae = "API key not found", Ne = "API key expired", Se = "Request cannot be parsed", De = "Request failed", be = "Request failed to process", Pe = "Too many requests, rate limit exceeded", Ce = "Not available for this origin", Ue = "Not available with restricted header", Le = Te, Me = Ae, xe = Ne;
  var ke = { load: P, defaultScriptUrlPattern: w, ERROR_SCRIPT_LOAD_FAIL: p, ERROR_API_KEY_EXPIRED: Ne, ERROR_API_KEY_INVALID: Ae, ERROR_API_KEY_MISSING: Te, ERROR_BAD_REQUEST_FORMAT: Se, ERROR_BAD_RESPONSE_FORMAT: d, ERROR_CLIENT_TIMEOUT: s, ERROR_CSP_BLOCK: f, ERROR_FORBIDDEN_ENDPOINT: ce, ERROR_FORBIDDEN_HEADER: Ue, ERROR_FORBIDDEN_ORIGIN: Ce, ERROR_GENERAL_SERVER_FAILURE: De, ERROR_HANDLE_AGENT_DATA: E, ERROR_INSTALLATION_METHOD_RESTRICTED: ie, ERROR_INTEGRATION_FAILURE: ae, ERROR_INVALID_ENDPOINT: R, ERROR_INVALID_PROXY_INTEGRATION_HEADERS: ue, ERROR_INVALID_PROXY_INTEGRATION_SECRET: le, ERROR_NETWORK_ABORT: u, ERROR_NETWORK_CONNECTION: l, ERROR_NETWORK_RESTRICTED: se, ERROR_PROXY_INTEGRATION_SECRET_ENVIRONMENT_MISMATCH: de, ERROR_RATE_LIMIT: Pe, ERROR_SERVER_TIMEOUT: be, ERROR_SUBSCRIPTION_NOT_ACTIVE: re, ERROR_TOKEN_EXPIRED: xe, ERROR_TOKEN_INVALID: Me, ERROR_TOKEN_MISSING: Le, ERROR_UNSUPPORTED_VERSION: oe, ERROR_WRONG_REGION: ne, defaultEndpoint: A, defaultTlsEndpoint: N, handleAgentData: ye };
  const FINGERPRINT_DEFAULTS = {
    apiKey: "BhQq2qOOYR3oeMTEKIc2",
    scriptUrlPattern: ["https://fp.alchemypay.org/web/v3/BhQq2qOOYR3oeMTEKIc2/loader_v3.9.9.js"],
    endpoint: ["https://fp.alchemypay.org"]
  };
  const FORTER_DEFAULTS = {
    siteId: "b132efccafac"
  };
  const CHECKOUT_PUBLIC_KEY_PROD = "pk_aldlsnx6lhkjggag4qe2nff4c4h";
  const CHECKOUT_PUBLIC_KEY_SANDBOX = "pk_sbox_srkhzyxmotpo6vnfhqixvs66kyt";
  const CHECKOUT_SCRIPT_PROD = "https://risk.checkout.com/cdn/risk/3.3.1/risk.js";
  const CHECKOUT_INTEGRITY_PROD = "sha384-bdtH448zhkYQQTsR0FB6/ITKVZ1zdSi5Dv5NN5AILI1ZBIMJFsqKs8Upm6bWD+DL";
  const CHECKOUT_SCRIPT_SANDBOX = "https://risk.sandbox.checkout.com/cdn/risk/3.3.1/risk.js";
  const CHECKOUT_INTEGRITY_SANDBOX = "sha384-NuldQYGHmN12FhNL/QlNXZ2H+T00OYzfkbbS8s6MvxpqOQUzRg48p+av2KjO8Yut";
  const WORLDPAY_ACTION_URL_DEFAULT = "https://centinelapi.cardinalcommerce.com/V1/Cruise/Collect";
  const WORLDPAY_DEFAULTS = {
    jwt: "",
    bin: "",
    actionUrl: WORLDPAY_ACTION_URL_DEFAULT
  };
  function mergeFingerprintConfig(cfg) {
    var _a, _b;
    return {
      apiKey: (cfg == null ? void 0 : cfg.apiKey) || FINGERPRINT_DEFAULTS.apiKey,
      scriptUrlPattern: ((_a = cfg == null ? void 0 : cfg.scriptUrlPattern) == null ? void 0 : _a.length) ? cfg.scriptUrlPattern : FINGERPRINT_DEFAULTS.scriptUrlPattern,
      endpoint: ((_b = cfg == null ? void 0 : cfg.endpoint) == null ? void 0 : _b.length) ? cfg.endpoint : FINGERPRINT_DEFAULTS.endpoint
    };
  }
  function mergeForterConfig(cfg) {
    return {
      siteId: (cfg == null ? void 0 : cfg.siteId) || FORTER_DEFAULTS.siteId
    };
  }
  function mergeCheckoutConfig(cfg, environment) {
    const useSandbox = environment === "TEST" || !!(cfg == null ? void 0 : cfg.publicKey) && cfg.publicKey.startsWith("pk_sbox_");
    const publicKey = (cfg == null ? void 0 : cfg.publicKey) || (useSandbox ? CHECKOUT_PUBLIC_KEY_SANDBOX : CHECKOUT_PUBLIC_KEY_PROD);
    const isSandboxKey = publicKey.startsWith("pk_sbox_");
    const scriptUrl = (cfg == null ? void 0 : cfg.scriptUrl) || (isSandboxKey ? CHECKOUT_SCRIPT_SANDBOX : CHECKOUT_SCRIPT_PROD);
    let integrity = (cfg == null ? void 0 : cfg.integrity) || "";
    if (!integrity) {
      if (scriptUrl === CHECKOUT_SCRIPT_SANDBOX) integrity = CHECKOUT_INTEGRITY_SANDBOX;
      else if (scriptUrl === CHECKOUT_SCRIPT_PROD) integrity = CHECKOUT_INTEGRITY_PROD;
    }
    return { publicKey, scriptUrl, integrity };
  }
  function mergeWorldPayConfig(cfg) {
    return {
      jwt: (cfg == null ? void 0 : cfg.jwt) || WORLDPAY_DEFAULTS.jwt,
      bin: (cfg == null ? void 0 : cfg.bin) ?? WORLDPAY_DEFAULTS.bin,
      actionUrl: (cfg == null ? void 0 : cfg.actionUrl) || WORLDPAY_DEFAULTS.actionUrl
    };
  }
  let cachedVisitorId = null;
  let inflight$2 = null;
  async function collectFingerprint(cfg) {
    if (cachedVisitorId) return cachedVisitorId;
    if (inflight$2) return inflight$2;
    inflight$2 = (async () => {
      try {
        const merged = mergeFingerprintConfig(cfg);
        const agent = await ke.load({
          apiKey: merged.apiKey,
          scriptUrlPattern: [...merged.scriptUrlPattern, ke.defaultScriptUrlPattern],
          endpoint: [...merged.endpoint, ke.defaultEndpoint]
        });
        const result = await agent.get();
        const visitorId = (result == null ? void 0 : result.visitorId) || "";
        if (visitorId) cachedVisitorId = visitorId;
        return visitorId;
      } catch {
        return "";
      } finally {
        inflight$2 = null;
      }
    })();
    return inflight$2;
  }
  function runForterBootstrap(siteId) {
    const source = '(function () {\n        var merchantConfig = {\n            csp: false,\n        };\n        var siteId = __PAY_SDK_FORTER_SITE_ID__;\nfunction t(t,e){for(var n=t.split(""),r=0;r<n.length;++r)n[r]=String.fromCharCode(n[r].charCodeAt(0)+e);return n.join("")}function e(e){return t(e,-_).replace(/%SN%/g,siteId)}function n(t){try{if("number"==typeof t&&window.location&&window.location.pathname){for(var e=window.location.pathname.split("/"),n=[],r=0;r<=Math.min(e.length-1,Math.abs(t));r++)n.push(e[r]);return n.join("/")||"/"}}catch(t){}return"/"}function r(){var t="no"+"op"+"fn",e="g"+"a",n="n"+"ame";return window[e]&&window[e][n]===t}function o(){return!(!navigator.brave||"function"!=typeof navigator.brave.isBrave)}function i(){return document.currentScript&&document.currentScript.src}function a(t){try{$.ex=t,r()&&-1===$.ex.indexOf(z.uB)&&($.ex+=z.uB),o()&&-1===$.ex.indexOf(z.uBr)&&($.ex+=z.uBr),i()&&-1===$.ex.indexOf(z.nIL)&&($.ex+=z.nIL),window.ftr__snp_cwc||($.ex+=z.s),H($)}catch(t){}}function c(t,e){function n(i){try{i.blockedURI===t&&i.disposition===o&&(e(),document.removeEventListener(r,n))}catch(t){document.removeEventListener(r,n)}}var r="securitypolicyviolation",o="enforce";document.addEventListener(r,n),setTimeout(function(){document.removeEventListener(r,n)},2*60*1e3)}function f(t,e,n,r){var o=!1;t="https://"+t,c(t,function(){r(!0),o=!0});var i=document.createElement("script");if(i.onerror=function(){if(!o)try{r(!1),o=!0}catch(t){}},i.onload=n,i.type="text/javascript",i.id="ftr__script",i.async=!0,i.src=t,window.ftr__config&&window.ftr__config.m&&!0===window.ftr__config.m.ptb&&document.body)document.body.appendChild(i);else{var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(i,a)}}function u(){setTimeout(l,B,z.uDF)}function s(t,e,n,r){var o=!1,i=new XMLHttpRequest;if(c("https:"+t,function(){n(new Error("CSP Violation"),!0),o=!0}),"//"===t.slice(0,2)&&(t="https:"+t),"withCredentials"in i)i.open("GET",t,!0);else{if("undefined"==typeof XDomainRequest)return;i=new XDomainRequest,i.open("GET",t)}Object.keys(r).forEach(function(t){i.setRequestHeader(t,r[t])}),i.onload=function(){"function"==typeof e&&e(i)},i.onerror=function(t){if("function"==typeof n&&!o)try{n(t,!1),o=!0}catch(t){}},i.onprogress=function(){},i.ontimeout=function(){"function"==typeof n&&n("tim"+"eo"+"ut",!1)},setTimeout(function(){i.send()},0)}function d(t,siteId,e){function n(t){var e=t.toString(16);return e.length%2?"0"+e:e}function r(t){if(t<=0)return"";for(var e="0123456789abcdef",n="",r=0;r<t;r++)n+=e[Math.floor(Math.random()*e.length)];return n}function o(t){for(var e="",r=0;r<t.length;r++)e+=n(t.charCodeAt(r));return e}function i(t){for(var e=t.split(""),n=0;n<e.length;++n)e[n]=String.fromCharCode(255^e[n].charCodeAt(0));return e.join("")}e=e?"1":"0";var a=[];return a.push(t),a.push(siteId),a.push(e),function(t){var e=40,n="";return t.length<e/2&&(n=","+r(e/2-t.length-1)),o(i(t+n))}(a.join(","))}function h(){function t(){M&&setTimeout(l,B,z.dUAL)}function e(t,e){M=e?"F"+"T"+"R"+"A"+"U"+"C":"F"+"T"+"R"+"A"+"U",setTimeout(l,B,z.uAS)}window.ftr__fdad(t,e)}function w(){function t(){M&&setTimeout(l,B,z.uDAD)}function e(t,e){M=e?"F"+"T"+"R"+"A"+"U"+"C":"F"+"T"+"R"+"A"+"U",setTimeout(l,B,z.uDS)}window.ftr__radd(t,e)}function l(t){function e(){for(var t=0;t<=z.tmosSecs.length;t++)clearTimeout(et[t])}function n(){try{e(),a(t+z.uS)}catch(t){}}function r(n){try{e(),$.td=1*new Date-$.ts,a(n?t+z.uF+z.cP:t+z.uF),t===z.uFP&&u(),t===z.uDF&&(j?w():h()),t!==z.uAS&&t!==z.dUAL||j||w(),t!==z.uDS&&t!==z.uDAD||j&&h()}catch(t){a(z.eUoe)}}try{!function(t){for(var e=0;e<=z.tmosSecs.length;e++)e===z.tmosSecs.length?et[e]=setTimeout(r,1e3*z.tmosSecs[e-1]+1e3):et[e]=setTimeout(a,1e3*z.tmosSecs[e],t+z.tmos[e])}(t);var o;switch(t){case z.uFP:o=N;break;case z.uDF:o=I;break;default:o=M}if(!o)return;if(o==="F"+"T"+"R"+"A"+"U"+"C")return void r(!0);if(o==="F"+"T"+"R"+"A"+"U")return void r(!1);f(o,void 0,n,r)}catch(e){a(t+z.eTlu)}}var g="22g5iz6v:uihsv}w1forxgiurqw1qhw2vwdwxv",v="fort",p="erTo",m="ken",_=3;window.ftr__config={m:merchantConfig,s:"31",si:siteId};var y=!1,U=!1,T,x,A=v+p+m,S=400*24*60,D,C=10;D={write:function(t,e,r,o){void 0===o&&(o=!0);var i=0;window.ftr__config&&window.ftr__config.m&&window.ftr__config.m.ckDepth&&(i=window.ftr__config.m.ckDepth);var a,c,f=n(i);if(r?(a=new Date,a.setTime(a.getTime()+60*r*1e3),c="; expires="+a.toGMTString()):c="",!o)return void(document.cookie=escape(t)+"="+escape(e)+c+"; path="+f);for(var u=1,s=document.domain.split("."),d=C,h=!0;h&&s.length>=u&&d>0;){var w=s.slice(-u).join(".");document.cookie=escape(t)+"="+escape(e)+c+"; path="+f+"; domain="+w;var l=D.read(t);null!=l&&l==e||(w="."+w,document.cookie=escape(t)+"="+escape(e)+c+"; path="+f+"; domain="+w),h=-1===document.cookie.indexOf(t+"="+e),u++,d--}},read:function(t){var e=null;try{for(var n=escape(t)+"=",r=document.cookie.split(";"),o=32,i=0;i<r.length;i++){for(var a=r[i];a.charCodeAt(0)===o;)a=a.substring(1,a.length);0===a.indexOf(n)&&(e=unescape(a.substring(n.length,a.length)))}}finally{return e}}};var R=window.ftr__config.s;R+="ck";var L=function(t){var e=!1,n=null,r=function(){try{if(!n||!e)return;n.remove&&"function"==typeof n.remove?n.remove():document.head.removeChild(n),e=!1}catch(t){}};document.head&&(!function(){n=document.createElement("link"),n.setAttribute("rel","pre"+"con"+"nect"),n.setAttribute("cros"+"sori"+"gin","anonymous"),n.onload=r,n.onerror=r,n.setAttribute("href",t),document.head.appendChild(n),e=!0}(),setTimeout(r,3e3))},E=e(g||"22g5iz6v:uihsv}w1forxgiurqw1qhw2vwdwxv"),q=t("[0Uhtxhvw0LG",-_),b=t("[0Fruuhodwlrq0LG",-_),P=t("Li0Qrqh0Pdwfk",-_),k=e("dss1vlwhshuirupdqfhwhvw1qhw"),F=e("2241414142gqv0txhu|"),M,O="fgq71iruwhu1frp",I,V;I=e("(VQ(1"+O+"2vq2(VQ(2vfulsw1mv"),V=e("(VQ(1"+O+"2vqV2(VQ(2vfulsw1mv");var N;window.ftr__config&&window.ftr__config.m&&window.ftr__config.m.fpi&&(N=e("fgq71")+window.ftr__config.m.fpi+e("2vq2(VQ(2vfulsw1mv"));var j=!1;j=!1;var B=10;window.ftr__startScriptLoad=1*new Date;var G=function(t){var e="ft"+"r:tok"+"enR"+"eady";window.ftr__tt&&clearTimeout(window.ftr__tt),window.ftr__tt=setTimeout(function(){try{delete window.ftr__tt,t+="_tt";var n=document.createEvent("Event");n.initEvent(e,!1,!1),n.detail=t,document.dispatchEvent(n)}catch(t){}},1e3)},H=function(t){var e=function(t){return t||""},n=e(t.id)+"_"+e(t.ts)+"_"+e(t.td)+"_"+e(t.ex)+"_"+e(R),r=S;!isNaN(window.ftr__config.m.ckTTL)&&window.ftr__config.m.ckTTL&&(r=window.ftr__config.m.ckTTL),D.write(A,n,r,!0),G(n),window.ftr__gt=n},X=function(){var t=D.read(A)||"",e=t.split("_"),n=function(t){return e[t]||void 0};return{id:n(0),ts:n(1),td:n(2),ex:n(3),vr:n(4)}},Q=function(){for(var t={},e="fgu",n=[],r=0;r<256;r++)n[r]=(r<16?"0":"")+r.toString(16);var o=function(t,e,r,o,i){var a=i?"-":"";return n[255&t]+n[t>>8&255]+n[t>>16&255]+n[t>>24&255]+a+n[255&e]+n[e>>8&255]+a+n[e>>16&15|64]+n[e>>24&255]+a+n[63&r|128]+n[r>>8&255]+a+n[r>>16&255]+n[r>>24&255]+n[255&o]+n[o>>8&255]+n[o>>16&255]+n[o>>24&255]},i=function(){if(window.Uint32Array&&window.crypto&&window.crypto.getRandomValues){var t=new window.Uint32Array(4);return window.crypto.getRandomValues(t),{d0:t[0],d1:t[1],d2:t[2],d3:t[3]}}return{d0:4294967296*Math.random()>>>0,d1:4294967296*Math.random()>>>0,d2:4294967296*Math.random()>>>0,d3:4294967296*Math.random()>>>0}},a=function(){var t="",e=function(t,e){for(var n="",r=t;r>0;--r)n+=e.charAt(1e3*Math.random()%e.length);return n};return t+=e(2,"0123456789"),t+=e(1,"123456789"),t+=e(8,"0123456789")};return t.safeGenerateNoDash=function(){try{var t=i();return o(t.d0,t.d1,t.d2,t.d3,!1)}catch(t){try{return e+a()}catch(t){}}},t.isValidNumericalToken=function(t){return t&&t.toString().length<=11&&t.length>=9&&parseInt(t,10).toString().length<=11&&parseInt(t,10).toString().length>=9},t.isValidUUIDToken=function(t){return t&&32===t.toString().length&&/^[a-z0-9]+$/.test(t)},t.isValidFGUToken=function(t){return 0==t.indexOf(e)&&t.length>=12},t}(),z={uDF:"UDF",dUAL:"dUAL",uAS:"UAS",uDS:"UDS",uDAD:"UDAD",uFP:"UFP",mLd:"1",eTlu:"2",eUoe:"3",uS:"4",uF:"9",tmos:["T5","T10","T15"],tmosSecs:[5,10,15],bIR:"43",uB:"u",uBr:"b",cP:"c",nIL:"i",s:"s"};try{var $=X();try{$.id&&(Q.isValidNumericalToken($.id)||Q.isValidUUIDToken($.id)||Q.isValidFGUToken($.id))?window.ftr__ncd=!1:($.id=Q.safeGenerateNoDash(),window.ftr__ncd=!0),$.ts=window.ftr__startScriptLoad,H($),window.ftr__snp_cwc=!!D.read(A),window.ftr__snp_cwc||(I=V);for(var J="for"+"ter"+".co"+"m",K="ht"+"tps://c"+"dn9."+J,W="ht"+"tps://"+$.id+"-"+siteId+".cd"+"n."+J,Y="http"+"s://cd"+"n3."+J,Z=[K,W,Y],tt=0;tt<Z.length;tt++)L(Z[tt]);var et=new Array(z.tmosSecs.length);window.ftr__fdad=function(e,n){if(y)return window.ftr__altd2=x,void e();y=!0;var r={};r[P]=d(window.ftr__config.s,siteId,window.ftr__config.m.csp),s(E,function(n){try{var r=n.getAllResponseHeaders().toLowerCase();if(r.indexOf(b.toLowerCase())>=0){var o=n.getResponseHeader(b);x=window.ftr__altd2=t(atob(o),-_-1)}if(r.indexOf(q.toLowerCase())<0)return;var i=n.getResponseHeader(q),a=t(atob(i),-_-1);if(a){var c=a.split(":");if(c&&2===c.length){for(var f=c[0],u=c[1],s="",d=0,h=0;d<20;++d)s+=d%3>0&&h<12?siteId.charAt(h++):$.id.charAt(d);var w=u.split(",");if(w.length>1){var l=w[0],g=w[1];M=f+"/"+l+"."+s+"."+g}}}e()}catch(t){}},function(t,e){n&&n(t,e)},r)},window.ftr__radd=function(t,e){function n(e){try{var n=e.response,r=function(t){function e(t,n,i){try{if(i>=r)return{name:"",nextOffsetToProcess:n,error:"Max pointer dereference depth exceeded"};for(var a=[],c=n,f=t.getUint8(c),u=0;u<o;){if(u++,192==(192&f)){var s=(63&f)<<8|t.getUint8(c+1),d=e(t,s,i+1);if(d.error)return d;var h=d.name;return a.push(h),{name:a.join("."),nextOffsetToProcess:c+2}}if(!(f>0)){if(0!==f)return{name:"",nextOffsetToProcess:c,error:"Unexpected length at the end of name: "+f.toString()};return{name:a.join("."),nextOffsetToProcess:c+1}}for(var w="",l=1;l<=f;l++)w+=String.fromCharCode(t.getUint8(c+l));a.push(w),c+=f+1,f=t.getUint8(c)}return{name:"",nextOffsetToProcess:c,error:"Max iterations exceeded"}}catch(t){return{name:"",nextOffsetToProcess:n,error:"Unexpected error while parsing response: "+t.toString()}}}var n,r=4,o=100,i=16,a=new DataView(t),c=a.getUint16(0),f=a.getUint16(2),u=a.getUint16(4),s=a.getUint16(6),d=a.getUint16(8),h=a.getUint16(10),w=12,l=[],g=0;for(g=0;g<u;g++){if(n=e(a,w,0),n.error)throw new Error(n.error);if(w=n.nextOffsetToProcess,!Number.isInteger(w))throw new Error("invalid returned offset");var v=n.name,p=a.getUint16(w);w+=2;var m=a.getUint16(w);w+=2,l.push({qname:v,qtype:p,qclass:m})}var _=[];for(g=0;g<s;g++){if(n=e(a,w,0),n.error)throw new Error(n.error);if(w=n.nextOffsetToProcess,!Number.isInteger(w))throw new Error("invalid returned offset");var y=n.name,U=a.getUint16(w);if(U!==i)throw new Error("Unexpected record type: "+U.toString());w+=2;var T=a.getUint16(w);w+=2;var x=a.getUint32(w);w+=4;var A=a.getUint16(w);w+=2;for(var S="",D=w,C=0;D<w+A&&C<o;){C++;var R=a.getUint8(D);D+=1;S+=(new TextDecoder).decode(t.slice(D,D+R)),D+=R}if(C>=o)throw new Error("Max iterations exceeded while reading TXT data");w+=A,_.push({name:y,type:U,class:T,ttl:x,data:S})}return{transactionId:c,flags:f,questionCount:u,answerCount:s,authorityCount:d,additionalCount:h,questions:l,answers:_}}(n);if(!r)throw new Error("Error parsing DNS response");if(!("answers"in r))throw new Error("Unexpected response");var o=r.answers;if(0===o.length)throw new Error("No answers found");var i=o[0].data;i=i.replace(/^"(.*)"$/,"$1");var a=function(t){var e=40,n=32,r=126;try{for(var o=atob(t),i="",a=0;a<o.length;a++)i+=function(t){var o=t.charCodeAt(0),i=o-e;return i<n&&(i=r-(n-i)+1),String.fromCharCode(i)}(o[a]);return atob(i)}catch(t){return}}(i);if(!a)throw new Error("failed to decode the value");var c=function(t){var e="_"+"D"+"L"+"M"+"_",n=t.split(e);if(!(n.length<2)){var r=n[0],o=n[1];if(!(r.split(".").length-1<1))return{jURL:r,eURL:o}}}(a);if(!c)throw new Error("failed to parse the value");var f=c.jURL,u=c.eURL;M=function(t){for(var e="",n=0,r=0;n<20;++n)e+=n%3>0&&r<12?siteId.charAt(r++):$.id.charAt(n);return t.replace("/PRM1","").replace("/PRM2","/main.").replace("/PRM3",e).replace("/PRM4",".js")}(f),T=window.ftr__altd3=u,t()}catch(t){}}function r(t,n){e&&e(t,n)}if(U)return window.ftr__altd3=T,void t();window.ftr__config.m.dr==="N"+"D"+"R"&&e(new Error("N"+"D"+"R"),!1),F&&k||e(new Error("D"+"P"+"P"),!1),U=!0;try{var o=function(t){for(var e=new Uint8Array([0,0]),n=new Uint8Array([1,0]),r=new Uint8Array([0,1]),o=new Uint8Array([0,0]),i=new Uint8Array([0,0]),a=new Uint8Array([0,0]),c=t.split("."),f=[],u=0;u<c.length;u++){var s=c[u];f.push(s.length);for(var d=0;d<s.length;d++)f.push(s.charCodeAt(d))}f.push(0);var h=16,w=new Uint8Array([0,h]),l=new Uint8Array([0,1]),g=new Uint8Array(e.length+n.length+r.length+o.length+i.length+a.length+f.length+w.length+l.length);return g.set(e,0),g.set(n,e.length),g.set(r,e.length+n.length),g.set(o,e.length+n.length+r.length),g.set(i,e.length+n.length+r.length+o.length),g.set(a,e.length+n.length+r.length+o.length+i.length),g.set(f,e.length+n.length+r.length+o.length+i.length+a.length),g.set(w,e.length+n.length+r.length+o.length+i.length+a.length+f.length),g.set(l,e.length+n.length+r.length+o.length+i.length+a.length+f.length+w.length),g}(k);!function(t,e,n,r,o){var i=!1,a=new XMLHttpRequest;if(c("https:"+t,function(){o(new Error("CSP Violation"),!0),i=!0}),"//"===t.slice(0,2)&&(t="https:"+t),"withCredentials"in a)a.open("POST",t,!0);else{if("undefined"==typeof XDomainRequest)return;a=new XDomainRequest,a.open("POST",t)}a.responseType="arraybuffer",a.setRequestHeader("Content-Type",e),a.onload=function(){"function"==typeof r&&r(a)},a.onerror=function(t){if("function"==typeof o&&!i)try{o(t,!1),i=!0}catch(t){}},a.onprogress=function(){},a.ontimeout=function(){"function"==typeof o&&o("tim"+"eo"+"ut",!1)},setTimeout(function(){a.send(n)},0)}(F,"application/dns-message",o,n,r)}catch(t){e(t,!1)}};var nt=N?z.uFP:z.uDF;setTimeout(l,B,nt)}catch(t){a(z.mLd)}}catch(t){}})();'.replace(
      "__PAY_SDK_FORTER_SITE_ID__",
      JSON.stringify(siteId)
    );
    (0, eval)(source);
  }
  const TOKEN_READY = "ftr:tokenReady";
  const COOKIE_NAME = "forterToken";
  const TIMEOUT_MS$1 = 15e3;
  let injectedSiteId = null;
  function readForterTokenCookie() {
    try {
      const parts = document.cookie.split(";");
      for (const part of parts) {
        const trimmed = part.trim();
        const prefix = `${COOKIE_NAME}=`;
        if (trimmed.startsWith(prefix)) {
          return decodeURIComponent(trimmed.slice(prefix.length)) || "";
        }
      }
    } catch {
    }
    return "";
  }
  async function collectForter(cfg) {
    const siteId = mergeForterConfig(cfg).siteId.trim();
    if (!siteId) return "";
    const cached = readForterTokenCookie();
    if (cached) return cached;
    return await new Promise((resolve) => {
      let settled = false;
      const finish = (token) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        document.removeEventListener(TOKEN_READY, onReady);
        resolve(token || "");
      };
      const onReady = (evt) => {
        const detail = evt.detail;
        finish(typeof detail === "string" ? detail : "");
      };
      const timer = window.setTimeout(() => {
        finish(readForterTokenCookie());
      }, TIMEOUT_MS$1);
      document.addEventListener(TOKEN_READY, onReady);
      try {
        if (injectedSiteId !== siteId) {
          runForterBootstrap(siteId);
          injectedSiteId = siteId;
        } else {
          const again = readForterTokenCookie();
          if (again) finish(again);
        }
      } catch {
        finish("");
      }
    });
  }
  let cachedDeviceSessionId = null;
  let inflight$1 = null;
  async function ensureRiskJs(scriptUrl, integrity) {
    if (window.Risk) return window.Risk;
    await loadScript(scriptUrl, {
      id: "risk-js",
      integrity: integrity || void 0,
      crossorigin: true,
      defer: true
    });
    if (!window.Risk) {
      throw new Error("Checkout Risk.js loaded but window.Risk is missing");
    }
    return window.Risk;
  }
  async function collectCheckout(cfg, environment) {
    if (cachedDeviceSessionId) return cachedDeviceSessionId;
    if (inflight$1) return inflight$1;
    inflight$1 = (async () => {
      try {
        const merged = mergeCheckoutConfig(cfg, environment);
        if (!merged.publicKey) return "";
        const Risk = await ensureRiskJs(merged.scriptUrl, merged.integrity);
        const risk = await Risk.create(merged.publicKey);
        const deviceSessionId = await risk.publishRiskData();
        const id = typeof deviceSessionId === "string" ? deviceSessionId : "";
        if (id) cachedDeviceSessionId = id;
        return id;
      } catch {
        return "";
      } finally {
        inflight$1 = null;
      }
    })();
    return inflight$1;
  }
  const IFRAME_ID = "pay-sdk-ddc-iframe";
  const TIMEOUT_MS = 1e4;
  let cachedSessionId = null;
  let inflight = null;
  function removeDdcIframe() {
    const existing = document.getElementById(IFRAME_ID);
    if (existing == null ? void 0 : existing.parentNode) existing.parentNode.removeChild(existing);
  }
  function startDeviceDataCollection(bin, jwt, actionUrl) {
    removeDdcIframe();
    const iframe = document.createElement("iframe");
    iframe.id = IFRAME_ID;
    iframe.name = IFRAME_ID;
    iframe.height = "1";
    iframe.width = "1";
    iframe.style.display = "none";
    document.body.appendChild(iframe);
    const form = document.createElement("form");
    form.method = "POST";
    form.action = actionUrl;
    form.target = IFRAME_ID;
    form.style.display = "none";
    const binInput = document.createElement("input");
    binInput.type = "hidden";
    binInput.name = "Bin";
    binInput.value = bin;
    form.appendChild(binInput);
    const jwtInput = document.createElement("input");
    jwtInput.type = "hidden";
    jwtInput.name = "JWT";
    jwtInput.value = jwt;
    form.appendChild(jwtInput);
    document.body.appendChild(form);
    form.submit();
    form.remove();
  }
  function parseSessionId(data) {
    try {
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      if (parsed && typeof parsed === "object" && "Status" in parsed && parsed.Status && "SessionId" in parsed) {
        const id = parsed.SessionId;
        return typeof id === "string" ? id : id != null ? String(id) : "";
      }
    } catch {
    }
    return "";
  }
  async function collectWorldPay(cfg) {
    if (cachedSessionId) return cachedSessionId;
    if (inflight) return inflight;
    inflight = (async () => {
      const merged = mergeWorldPayConfig(cfg);
      if (!merged.jwt) return "";
      let allowedOrigin;
      try {
        allowedOrigin = new URL(merged.actionUrl).origin;
      } catch {
        return "";
      }
      return await new Promise((resolve) => {
        let settled = false;
        const finish = (sessionId) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timer);
          window.removeEventListener("message", onMessage);
          removeDdcIframe();
          if (sessionId) cachedSessionId = sessionId;
          resolve(sessionId);
        };
        const onMessage = (event) => {
          if (event.origin !== allowedOrigin) return;
          const sessionId = parseSessionId(event.data);
          if (sessionId) finish(sessionId);
        };
        const timer = window.setTimeout(() => finish(""), TIMEOUT_MS);
        try {
          window.addEventListener("message", onMessage);
          startDeviceDataCollection(merged.bin, merged.jwt, merged.actionUrl);
        } catch {
          finish("");
        }
      });
    })().finally(() => {
      inflight = null;
    });
    return inflight;
  }
  function isEnabled(enabled) {
    return enabled === true;
  }
  async function collectRisk(risk, environment) {
    var _a, _b, _c, _d;
    if (!risk) return {};
    const tasks = [];
    const payload = {};
    if (isEnabled((_a = risk.fingerprint) == null ? void 0 : _a.enabled)) {
      tasks.push(
        collectFingerprint(risk.fingerprint).then((visitorId) => {
          if (visitorId) payload.fingerprint = { visitorId };
        })
      );
    }
    if (isEnabled((_b = risk.forter) == null ? void 0 : _b.enabled)) {
      tasks.push(
        collectForter(risk.forter).then((token) => {
          if (token) payload.forter = { token };
        })
      );
    }
    if (isEnabled((_c = risk.checkout) == null ? void 0 : _c.enabled)) {
      tasks.push(
        collectCheckout(risk.checkout, environment).then((deviceSessionId) => {
          if (deviceSessionId) payload.checkout = { deviceSessionId };
        })
      );
    }
    if (isEnabled((_d = risk.worldPay) == null ? void 0 : _d.enabled)) {
      tasks.push(
        collectWorldPay(risk.worldPay).then((sessionId) => {
          if (sessionId) payload.worldPay = { sessionId };
        })
      );
    }
    await Promise.all(tasks);
    return payload;
  }
  function resolveRiskCollection(config) {
    if (config.riskCollection) return config.riskCollection;
    return collectRisk(config.risk, config.environment);
  }
  const paymentsClients = /* @__PURE__ */ new WeakMap();
  function merchantInfo(config) {
    var _a;
    const gp = config.googlePay;
    if ((_a = gp == null ? void 0 : gp.paymentDataRequest) == null ? void 0 : _a.merchantInfo) {
      return gp.paymentDataRequest.merchantInfo;
    }
    const info = {
      merchantName: (gp == null ? void 0 : gp.merchantName) || "Merchant"
    };
    if (gp == null ? void 0 : gp.merchantId) info.merchantId = gp.merchantId;
    return info;
  }
  function getPaymentsClient(config) {
    const cached = paymentsClients.get(config);
    if (cached) return cached;
    const client = new google.payments.api.PaymentsClient({
      environment: config.environment === "TEST" ? "TEST" : "PRODUCTION",
      merchantInfo: merchantInfo(config)
    });
    paymentsClients.set(config, client);
    return client;
  }
  function buildCardPaymentMethod(config) {
    const gp = config.googlePay;
    const parameters = {
      allowedAuthMethods: (gp == null ? void 0 : gp.allowedAuthMethods) || ["PAN_ONLY", "CRYPTOGRAM_3DS"],
      allowedCardNetworks: (gp == null ? void 0 : gp.allowedCardNetworks) || ["MASTERCARD", "VISA"]
    };
    if (config.billingAddressRequired) {
      parameters.billingAddressRequired = true;
      parameters.billingAddressParameters = {
        format: "FULL",
        phoneNumberRequired: false
      };
    }
    return {
      type: "CARD",
      parameters,
      tokenizationSpecification: gp.tokenizationSpecification
    };
  }
  function buildGoogleBaseRequest(config) {
    var _a;
    const request = (_a = config.googlePay) == null ? void 0 : _a.paymentDataRequest;
    return {
      apiVersion: (request == null ? void 0 : request.apiVersion) || 2,
      apiVersionMinor: (request == null ? void 0 : request.apiVersionMinor) || 0,
      allowedPaymentMethods: (request == null ? void 0 : request.allowedPaymentMethods) || [buildCardPaymentMethod(config)]
    };
  }
  function buildPaymentDataRequest(config) {
    var _a;
    const provided = (_a = config.googlePay) == null ? void 0 : _a.paymentDataRequest;
    if (provided) {
      return {
        ...provided,
        callbackIntents: (provided.callbackIntents || []).filter(
          (intent) => intent !== "PAYMENT_AUTHORIZATION"
        )
      };
    }
    const payment = config.payment;
    return {
      apiVersion: 2,
      apiVersionMinor: 0,
      allowedPaymentMethods: [buildCardPaymentMethod(config)],
      merchantInfo: merchantInfo(config),
      transactionInfo: {
        countryCode: payment.countryCode,
        currencyCode: payment.currency,
        totalPriceStatus: "FINAL",
        totalPrice: String(payment.amount),
        totalPriceLabel: "Total"
      }
    };
  }
  function buttonOptions(config, onClick) {
    var _a;
    const btn = ((_a = config.googlePay) == null ? void 0 : _a.button) || {};
    const options = {
      onClick,
      buttonColor: btn.buttonColor || "default",
      buttonType: btn.buttonType || "plain",
      buttonSizeMode: btn.buttonSizeMode || "fill"
    };
    if (btn.buttonLocale) options.buttonLocale = btn.buttonLocale;
    return options;
  }
  function createGoogleButton(config, onClick) {
    return getPaymentsClient(config).createButton(buttonOptions(config, onClick));
  }
  async function payWithGoogle(config) {
    var _a, _b, _c;
    const client = getPaymentsClient(config);
    const riskPromise = resolveRiskCollection(config);
    try {
      const paymentData = await client.loadPaymentData(buildPaymentDataRequest(config));
      const risk = await riskPromise;
      await ((_a = config.onSuccess) == null ? void 0 : _a.call(config, { ...normalizeGoogleResult(paymentData), risk }));
    } catch (err) {
      if (isGoogleCancel(err)) {
        (_b = config.onCancel) == null ? void 0 : _b.call(config);
        return;
      }
      (_c = config.onError) == null ? void 0 : _c.call(config, toError(err));
    }
  }
  async function readyGooglePay(config) {
    var _a, _b;
    await loadGooglePay();
    if (!((_b = (_a = window.google) == null ? void 0 : _a.payments) == null ? void 0 : _b.api)) {
      throw new Error("Google Pay JS failed to load");
    }
    const client = getPaymentsClient(config);
    const res = await client.isReadyToPay(buildGoogleBaseRequest(config));
    if (!(res == null ? void 0 : res.result)) {
      throw new Error("Google Pay is not available for this user/environment");
    }
    return true;
  }
  async function readyApplePay() {
    await loadApplePay();
    if (typeof ApplePaySession === "undefined") {
      throw new Error("Apple Pay is not supported in this browser");
    }
    if (!ApplePaySession.canMakePayments()) {
      throw new Error("Apple Pay cannot make payments on this device");
    }
    return true;
  }
  function ready(config) {
    if (config.method === "googlePay") return readyGooglePay(config);
    if (config.method === "applePay") return readyApplePay();
    return Promise.reject(new Error(`Unknown payment method: ${config.method}`));
  }
  const APPLE_BUTTON_STYLE_ID = "pay-sdk-apple-button-style";
  function resolveContainer(container) {
    const el = typeof container === "string" ? document.querySelector(container) : container;
    if (!el) throw new Error(`Pay SDK container not found: ${String(container)}`);
    return el;
  }
  function injectAppleButtonStyle() {
    if (document.getElementById(APPLE_BUTTON_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = APPLE_BUTTON_STYLE_ID;
    style.textContent = `
apple-pay-button {
  --apple-pay-button-width: 100%;
  --apple-pay-button-height: 40px;
  --apple-pay-button-border-radius: 4px;
  --apple-pay-button-padding: 0px 0px;
  --apple-pay-button-box-sizing: border-box;
}`;
    document.head.appendChild(style);
  }
  function renderAppleButton(el, config, onClick) {
    var _a;
    injectAppleButtonStyle();
    const btn = ((_a = config.applePay) == null ? void 0 : _a.button) || {};
    const button = document.createElement("apple-pay-button");
    button.setAttribute("buttonstyle", btn.buttonstyle || "black");
    button.setAttribute("type", btn.type || "plain");
    button.setAttribute("locale", btn.locale || "en-US");
    button.addEventListener("click", onClick);
    el.appendChild(button);
    return button;
  }
  function renderGoogleButton(el, config, onClick) {
    const button = createGoogleButton(config, onClick);
    el.appendChild(button);
    return button;
  }
  function renderButton(config, onClick) {
    const el = resolveContainer(config.container);
    el.innerHTML = "";
    if (config.method === "googlePay") return renderGoogleButton(el, config, onClick);
    if (config.method === "applePay") return renderAppleButton(el, config, onClick);
    throw new Error(`Unknown payment method: ${config.method}`);
  }
  const APPLE_PAY_VERSION = 3;
  const DEFAULT_CAPABILITIES = [
    "supports3DS",
    "supportsCredit",
    "supportsDebit"
  ];
  const DEFAULT_NETWORKS = ["masterCard", "visa"];
  const BILLING_CONTACT_FIELDS = [
    "name",
    "postalAddress",
    "phone",
    "email"
  ];
  function buildPaymentRequest(config) {
    const payment = config.payment;
    const ap = config.applePay;
    if (ap == null ? void 0 : ap.paymentRequest) {
      return ap.paymentRequest;
    }
    const request = {
      countryCode: payment.countryCode,
      currencyCode: payment.currency,
      merchantCapabilities: (ap == null ? void 0 : ap.merchantCapabilities) || DEFAULT_CAPABILITIES,
      supportedNetworks: (ap == null ? void 0 : ap.supportedNetworks) || DEFAULT_NETWORKS,
      total: {
        label: (ap == null ? void 0 : ap.totalLabel) || "ALCHEMY GPS EUROPE UAB",
        type: (ap == null ? void 0 : ap.totalType) || "final",
        amount: String(payment.amount)
      }
    };
    if (config.billingAddressRequired) {
      request.requiredBillingContactFields = BILLING_CONTACT_FIELDS;
    }
    return request;
  }
  function payWithApple(config) {
    var _a;
    const ap = config.applePay;
    if (!(ap == null ? void 0 : ap.validateMerchant)) {
      (_a = config.onError) == null ? void 0 : _a.call(config, new Error("Apple Pay merchant validation is not configured"));
      return;
    }
    const riskPromise = resolveRiskCollection(config);
    const session = new ApplePaySession(APPLE_PAY_VERSION, buildPaymentRequest(config));
    session.onvalidatemerchant = async (event) => {
      var _a2;
      try {
        const merchantSession = await ap.validateMerchant(event.validationURL);
        session.completeMerchantValidation(merchantSession);
      } catch (err) {
        session.abort();
        (_a2 = config.onError) == null ? void 0 : _a2.call(config, toError(err));
      }
    };
    session.onpaymentauthorized = (event) => {
      void (async () => {
        var _a2, _b;
        try {
          const base = normalizeAppleResult(event.payment);
          const risk = await riskPromise;
          await ((_a2 = config.onSuccess) == null ? void 0 : _a2.call(config, { ...base, risk }));
          session.completePayment(ApplePaySession.STATUS_SUCCESS);
        } catch (err) {
          try {
            session.completePayment(ApplePaySession.STATUS_FAILURE);
          } catch {
          }
          (_b = config.onError) == null ? void 0 : _b.call(config, toError(err));
        }
      })();
    };
    session.oncancel = () => {
      var _a2;
      (_a2 = config.onCancel) == null ? void 0 : _a2.call(config);
    };
    session.begin();
  }
  const SUCCESS_RETURN_CODE = "0000";
  class PayApiError extends Error {
    constructor(message, details = {}) {
      super(message);
      this.name = "PayApiError";
      this.returnCode = details.returnCode;
      this.traceId = details.traceId;
      this.status = details.status;
    }
  }
  class PayApiClient {
    constructor(config) {
      this.config = config;
      this.fetcher = config.fetch || window.fetch.bind(window);
    }
    createOrder(request) {
      return this.request(this.config.createOrderUrl, "POST", request);
    }
    getValidateMerchantUrl(override) {
      return override || this.config.validateMerchantUrl;
    }
    validateMerchant(url, orderId, validationURL) {
      return this.request(this.getValidateMerchantUrl(url), "POST", {
        orderId,
        validationURL
      });
    }
    pay(request) {
      return this.request(this.config.payUrl, "POST", request);
    }
    queryOrder(orderId) {
      const encoded = encodeURIComponent(orderId);
      const template = this.config.queryOrderUrl;
      const url = template.includes("{orderId}") ? template.replace("{orderId}", encoded) : `${template.replace(/\/$/, "")}/${encoded}`;
      return this.request(url, "GET");
    }
    async headers(includeContentType) {
      const configured = typeof this.config.headers === "function" ? await this.config.headers() : this.config.headers;
      return includeContentType ? { "Content-Type": "application/json", ...configured } : { ...configured };
    }
    async request(url, method, body) {
      let response;
      try {
        response = await this.fetcher(url, {
          method,
          headers: await this.headers(body !== void 0),
          body: body === void 0 ? void 0 : JSON.stringify(body)
        });
      } catch (error) {
        throw error instanceof Error ? error : new PayApiError("Pay API network request failed");
      }
      let envelope;
      try {
        envelope = await response.json();
      } catch {
        throw new PayApiError(
          response.ok ? "Pay API returned invalid JSON" : `Pay API request failed with status ${response.status}`,
          { status: response.status }
        );
      }
      if (!response.ok || !envelope || envelope.returnCode !== SUCCESS_RETURN_CODE) {
        throw new PayApiError((envelope == null ? void 0 : envelope.returnMsg) || "Pay API request failed", {
          returnCode: envelope == null ? void 0 : envelope.returnCode,
          traceId: envelope == null ? void 0 : envelope.traceId,
          status: response.status
        });
      }
      return envelope.data;
    }
  }
  let nextActionViewId = 0;
  function describePayResponse(response) {
    if (response.MD || response.JWT || response.action) {
      if (!(response.MD && response.JWT && response.action)) {
        throw new Error("Incomplete 3DS action fields (MD, JWT, action are all required)");
      }
      return {
        type: "threeDS",
        url: response.action,
        MD: response.MD,
        JWT: response.JWT,
        action: response.action
      };
    }
    if (response.webUrl) {
      return {
        type: "webUrl",
        url: response.webUrl,
        webUrl: response.webUrl
      };
    }
    if (response.threeDSMethodData || response.methodUrl) {
      if (!(response.threeDSMethodData && response.methodUrl)) {
        throw new Error(
          "Incomplete threeDSMethod fields (threeDSMethodData and methodUrl are required)"
        );
      }
      return {
        type: "threeDSMethod",
        url: response.methodUrl,
        threeDSMethodData: response.threeDSMethodData,
        methodUrl: response.methodUrl
      };
    }
    return null;
  }
  function describeS3ds(s3dsUrl) {
    return {
      type: "s3ds",
      url: s3dsUrl,
      s3dsUrl
    };
  }
  class PaymentActionView {
    constructor() {
      this.methodFrameName = `pay-sdk-method-${++nextActionViewId}`;
      this.challengeFrameName = `pay-sdk-challenge-${nextActionViewId}`;
      this.challengeOverlay = null;
      this.methodFrame = null;
    }
    open(action) {
      if (action.type === "webUrl" || action.type === "s3ds") {
        window.location.assign(action.url);
        return;
      }
      if (action.type === "threeDS") {
        this.openChallenge(action.action, { MD: action.MD, JWT: action.JWT });
        return;
      }
      this.openFormHidden(action.methodUrl, {
        threeDSMethodData: action.threeDSMethodData
      });
    }
    destroy() {
      var _a, _b;
      (_a = this.challengeOverlay) == null ? void 0 : _a.remove();
      this.challengeOverlay = null;
      (_b = this.methodFrame) == null ? void 0 : _b.remove();
      this.methodFrame = null;
    }
    openChallenge(url, fields) {
      var _a;
      (_a = this.challengeOverlay) == null ? void 0 : _a.remove();
      const overlay = document.createElement("div");
      overlay.setAttribute("data-pay-sdk-challenge", "");
      Object.assign(overlay.style, {
        position: "fixed",
        inset: "0",
        zIndex: "2147483647",
        background: "rgba(0, 0, 0, 0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        boxSizing: "border-box"
      });
      const iframe = document.createElement("iframe");
      iframe.name = this.challengeFrameName;
      iframe.title = "3D Secure verification";
      Object.assign(iframe.style, {
        width: "min(100%, 390px)",
        height: "min(100%, 400px)",
        border: "0",
        background: "#fff"
      });
      overlay.appendChild(iframe);
      document.body.appendChild(overlay);
      this.challengeOverlay = overlay;
      const form = document.createElement("form");
      form.method = "POST";
      form.action = url;
      form.target = this.challengeFrameName;
      form.style.display = "none";
      this.appendFields(form, fields);
      document.body.appendChild(form);
      form.submit();
      form.remove();
    }
    openFormHidden(url, fields) {
      var _a;
      (_a = this.methodFrame) == null ? void 0 : _a.remove();
      const iframe = document.createElement("iframe");
      iframe.name = this.methodFrameName;
      iframe.width = "0";
      iframe.height = "0";
      iframe.style.display = "none";
      iframe.setAttribute("aria-hidden", "true");
      document.body.appendChild(iframe);
      this.methodFrame = iframe;
      const form = document.createElement("form");
      form.method = "POST";
      form.action = url;
      form.target = this.methodFrameName;
      form.style.display = "none";
      this.appendFields(form, fields);
      document.body.appendChild(form);
      form.submit();
      form.remove();
    }
    appendFields(form, fields) {
      for (const [name, value] of Object.entries(fields)) {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }
    }
  }
  const API_BASE = {
    TEST: "https://api-test.alchemytech.cc",
    PRODUCTION: "https://api.alchemypay.org"
  };
  const API_PATHS = {
    createOrder: "/v1/pay/orders",
    validateMerchant: "/pay/apple/domainName/verify",
    pay: "/v1/pay/payments",
    queryOrder: "/v1/pay/orders/{orderId}"
  };
  function getApiEndpoints(environment = "PRODUCTION") {
    const base = API_BASE[environment];
    return {
      createOrderUrl: `${base}${API_PATHS.createOrder}`,
      validateMerchantUrl: `${base}${API_PATHS.validateMerchant}`,
      payUrl: `${base}${API_PATHS.pay}`,
      queryOrderUrl: `${base}${API_PATHS.queryOrder}`
    };
  }
  function resolvePayApiConfig(environment, overrides) {
    const defaults = getApiEndpoints(environment);
    return {
      createOrderUrl: (overrides == null ? void 0 : overrides.createOrderUrl) || defaults.createOrderUrl,
      validateMerchantUrl: (overrides == null ? void 0 : overrides.validateMerchantUrl) || defaults.validateMerchantUrl,
      payUrl: (overrides == null ? void 0 : overrides.payUrl) || defaults.payUrl,
      queryOrderUrl: (overrides == null ? void 0 : overrides.queryOrderUrl) || defaults.queryOrderUrl,
      headers: overrides == null ? void 0 : overrides.headers,
      fetch: overrides == null ? void 0 : overrides.fetch,
      pollIntervalMs: overrides == null ? void 0 : overrides.pollIntervalMs,
      pollTimeoutMs: overrides == null ? void 0 : overrides.pollTimeoutMs
    };
  }
  function resolveEnvironment(environment) {
    return environment === "TEST" ? "TEST" : "PRODUCTION";
  }
  function validateConfig(config) {
    if (!config || typeof config !== "object") {
      throw new Error("PaySdk.init requires a config object");
    }
    if (!config.container) {
      throw new Error("config.container is required");
    }
    if (!config.order || config.order.amount == null || !config.order.currency || !config.order.countryCode) {
      throw new Error("order.amount, order.currency and order.countryCode are required");
    }
  }
  function hasSecondaryAction(response) {
    return !!(response.webUrl || response.MD || response.JWT || response.action || response.threeDSMethodData || response.methodUrl);
  }
  function isTransientPollError(error) {
    if (error instanceof PayApiError) {
      if (error.status != null && error.status >= 500) return true;
      if (error.returnCode && error.returnCode !== "0000") return false;
      return error.status == null;
    }
    return error instanceof TypeError;
  }
  function withoutPaymentAuthorization(intents) {
    return (intents || []).filter((intent) => intent !== "PAYMENT_AUTHORIZATION");
  }
  function runtimeConfigFromOrder(config, order, api, onWalletAuthorized) {
    var _a;
    const environment = resolveEnvironment(config.environment || order.environment);
    const common = {
      container: config.container,
      environment,
      risk: order.risk,
      onSuccess: onWalletAuthorized,
      onError: config.onError,
      onCancel: config.onCancel
    };
    if (order.method === "googlePay") {
      const card = order.params.allowedPaymentMethods[0];
      if (!(card == null ? void 0 : card.tokenizationSpecification)) {
        throw new Error("Create order response is missing Google Pay tokenizationSpecification");
      }
      const parameters = card.parameters;
      return {
        ...common,
        method: "googlePay",
        payment: {
          amount: order.params.transactionInfo.totalPrice,
          currency: order.params.transactionInfo.currencyCode,
          countryCode: order.params.transactionInfo.countryCode || config.order.countryCode
        },
        billingAddressRequired: parameters.billingAddressRequired === true,
        googlePay: {
          merchantId: order.params.merchantInfo.merchantId,
          merchantName: order.params.merchantInfo.merchantName,
          allowedAuthMethods: parameters.allowedAuthMethods,
          allowedCardNetworks: parameters.allowedCardNetworks,
          tokenizationSpecification: card.tokenizationSpecification,
          paymentDataRequest: {
            ...order.params,
            callbackIntents: withoutPaymentAuthorization(order.params.callbackIntents)
          }
        }
      };
    }
    const validateMerchantUrl = api.getValidateMerchantUrl(order.validateMerchantUrl);
    return {
      ...common,
      method: "applePay",
      payment: {
        amount: order.params.total.amount,
        currency: order.params.currencyCode,
        countryCode: order.params.countryCode
      },
      billingAddressRequired: (((_a = order.params.requiredBillingContactFields) == null ? void 0 : _a.length) || 0) > 0,
      applePay: {
        validateMerchantUrl,
        validateMerchant: (validationURL) => api.validateMerchant(validateMerchantUrl, order.orderId, validationURL),
        merchantCapabilities: order.params.merchantCapabilities,
        supportedNetworks: order.params.supportedNetworks,
        totalLabel: order.params.total.label,
        totalType: order.params.total.type,
        paymentRequest: order.params
      }
    };
  }
  class PaySdk2 {
    constructor(config) {
      this.actionView = new PaymentActionView();
      this._readyPromise = null;
      this._button = null;
      this.runtimeConfig = null;
      this.order = null;
      this.pollTimer = null;
      this.pollDelayResolve = null;
      this.pollGeneration = 0;
      this.paymentInFlight = false;
      this.destroyed = false;
      this.config = config;
      this.api = new PayApiClient(
        resolvePayApiConfig(resolveEnvironment(config.environment), config.api)
      );
    }
    ready() {
      if (!this._readyPromise) {
        this._readyPromise = this.prepare();
      }
      return this._readyPromise;
    }
    async prepare() {
      var _a, _b;
      if (!this.runtimeConfig) {
        const order = await this.api.createOrder(this.config.order);
        this.order = order;
        (_b = (_a = this.config).onOrderCreated) == null ? void 0 : _b.call(_a, order);
        const environment = resolveEnvironment(this.config.environment || order.environment);
        this.api = new PayApiClient(resolvePayApiConfig(environment, this.config.api));
        this.runtimeConfig = runtimeConfigFromOrder(
          this.config,
          order,
          this.api,
          async (result) => {
            await this.processPayment(result);
          }
        );
        this.runtimeConfig.riskCollection = collectRisk(
          this.runtimeConfig.risk,
          this.runtimeConfig.environment
        );
      }
      return ready(this.runtimeConfig);
    }
    _pay() {
      const config = this.runtimeConfig;
      if (!config) {
        void this.ready().then(() => this._pay()).catch((error) => {
          var _a, _b;
          return (_b = (_a = this.config).onError) == null ? void 0 : _b.call(_a, toError(error));
        });
        return;
      }
      if (config.method === "googlePay") {
        void payWithGoogle(config);
        return;
      }
      payWithApple(config);
    }
    mount() {
      if (this.runtimeConfig) {
        this.render();
      } else {
        void this.ready().then(() => this.render()).catch((error) => {
          var _a, _b;
          return (_b = (_a = this.config).onError) == null ? void 0 : _b.call(_a, toError(error));
        });
      }
      return this;
    }
    openAction(action) {
      this.actionView.open(action);
    }
    getActionMode() {
      return this.config.actionMode || "callback";
    }
    async dispatchAction(action) {
      var _a, _b;
      (_b = (_a = this.config).onAction) == null ? void 0 : _b.call(_a, action);
      if (this.getActionMode() !== "auto") return "deferred";
      const handled = this.config.openAction ? await this.config.openAction(action) : false;
      if (handled === true) return "opened";
      this.actionView.open(action);
      if (action.type === "webUrl" || action.type === "s3ds") return "navigated";
      return "opened";
    }
    render() {
      if (this.destroyed || !this.runtimeConfig) return;
      this._button = renderButton(this.runtimeConfig, () => this._pay());
    }
    async processPayment(walletResult) {
      if (!this.order) {
        throw new Error("Order is not ready");
      }
      if (this.destroyed) return;
      if (this.paymentInFlight) {
        throw new Error("Payment already in progress");
      }
      this.paymentInFlight = true;
      try {
        const request = this.buildPayRequest(walletResult);
        const paymentResponse = await this.api.pay(request);
        if (this.destroyed) return;
        if (!hasSecondaryAction(paymentResponse)) {
          this.finish(walletResult, paymentResponse);
          return;
        }
        const action = describePayResponse(paymentResponse);
        if (this.destroyed) return;
        if (action) await this.dispatchAction(action);
        void this.pollOrder(walletResult, paymentResponse);
      } catch (error) {
        this.paymentInFlight = false;
        this.stopPolling();
        this.actionView.destroy();
        throw error instanceof Error ? error : toError(error);
      }
    }
    buildPayRequest(walletResult) {
      if (!this.order) throw new Error("Order is not ready");
      if (walletResult.method === "googlePay") {
        if (!walletResult.token) throw new Error("Google Pay token is missing");
        return {
          orderId: this.order.orderId,
          encryptedData: walletResult.token,
          billingAddress: normalizeGoogleBillingAddress(
            walletResult.billingAddress,
            walletResult.email
          ),
          risk: walletResult.risk
        };
      }
      if (!walletResult.token) throw new Error("Apple Pay token is missing");
      return {
        orderId: this.order.orderId,
        encryptedData: normalizeAppleToken(walletResult.token),
        billingAddress: normalizeAppleBillingAddress(walletResult.billingContact),
        risk: walletResult.risk
      };
    }
    async pollOrder(walletResult, paymentResponse) {
      var _a, _b;
      const apiConfig = this.config.api;
      const interval = (apiConfig == null ? void 0 : apiConfig.pollIntervalMs) || 2e3;
      const timeoutMs = (apiConfig == null ? void 0 : apiConfig.pollTimeoutMs) ?? 3e5;
      const startedAt = Date.now();
      const generation = ++this.pollGeneration;
      let lastS3dsUrl = "";
      let consecutiveTransientErrors = 0;
      let firstTick = true;
      while (!this.destroyed && this.order && generation === this.pollGeneration) {
        if (!firstTick) await this.delay(interval);
        firstTick = false;
        if (this.destroyed || !this.order || generation !== this.pollGeneration) return;
        if (Date.now() - startedAt > timeoutMs) {
          this.fail(new Error("Payment status polling timed out"));
          return;
        }
        try {
          const current = await this.api.queryOrder(this.order.orderId);
          if (this.destroyed || generation !== this.pollGeneration) return;
          consecutiveTransientErrors = 0;
          (_b = (_a = this.config).onStatusChange) == null ? void 0 : _b.call(_a, current);
          if (current.s3dsUrl && current.s3dsUrl !== lastS3dsUrl) {
            lastS3dsUrl = current.s3dsUrl;
            const outcome = await this.dispatchAction(describeS3ds(current.s3dsUrl));
            if (outcome === "navigated") {
              this.stopPolling();
              return;
            }
          }
          if (current.status === "failed") {
            throw new Error(current.failureReason || "Payment failed");
          }
          if (current.status === "succeeded") {
            this.finish(walletResult, paymentResponse, current);
            return;
          }
          if (current.s3dsComplete === true) {
            this.complete(walletResult, paymentResponse, current);
            return;
          }
        } catch (error) {
          if (this.destroyed || generation !== this.pollGeneration) return;
          if (isTransientPollError(error)) {
            consecutiveTransientErrors += 1;
            if (consecutiveTransientErrors < 5) continue;
          }
          this.fail(toError(error));
          return;
        }
      }
    }
    delay(ms) {
      return new Promise((resolve) => {
        this.pollDelayResolve = () => resolve();
        this.pollTimer = window.setTimeout(() => {
          this.pollDelayResolve = null;
          this.pollTimer = null;
          resolve();
        }, ms);
      });
    }
    stopPolling() {
      this.pollGeneration += 1;
      if (this.pollTimer != null) {
        window.clearTimeout(this.pollTimer);
        this.pollTimer = null;
      }
      const resume = this.pollDelayResolve;
      this.pollDelayResolve = null;
      resume == null ? void 0 : resume();
    }
    finish(walletResult, paymentResponse, order) {
      var _a, _b, _c, _d, _e2;
      this.stopPolling();
      this.actionView.destroy();
      this.paymentInFlight = false;
      const result = {
        ...walletResult,
        orderId: (_a = this.order) == null ? void 0 : _a.orderId,
        paymentResponse,
        order
      };
      void ((_c = (_b = this.config).onSuccess) == null ? void 0 : _c.call(_b, result));
      (_e2 = (_d = this.config).onComplete) == null ? void 0 : _e2.call(_d, result);
    }
    complete(walletResult, paymentResponse, order) {
      var _a, _b, _c;
      this.stopPolling();
      this.actionView.destroy();
      this.paymentInFlight = false;
      (_c = (_b = this.config).onComplete) == null ? void 0 : _c.call(_b, {
        ...walletResult,
        orderId: (_a = this.order) == null ? void 0 : _a.orderId,
        paymentResponse,
        order
      });
    }
    fail(error) {
      var _a, _b;
      this.stopPolling();
      this.actionView.destroy();
      this.paymentInFlight = false;
      (_b = (_a = this.config).onError) == null ? void 0 : _b.call(_a, error);
    }
    destroy() {
      var _a;
      this.destroyed = true;
      this.stopPolling();
      this.actionView.destroy();
      this.paymentInFlight = false;
      (_a = this._button) == null ? void 0 : _a.remove();
      this._button = null;
      if (this.runtimeConfig) {
        resolveContainer(this.runtimeConfig.container).replaceChildren();
      }
    }
  }
  function init(config) {
    validateConfig(config);
    return new PaySdk2(config);
  }
  if (typeof window !== "undefined") {
    window.PaySdk = { init };
  }
  exports.PayApiError = PayApiError;
  exports.describePayResponse = describePayResponse;
  exports.describeS3ds = describeS3ds;
  exports.getApiEndpoints = getApiEndpoints;
  exports.init = init;
  exports.resolveEnvironment = resolveEnvironment;
  exports.resolvePayApiConfig = resolvePayApiConfig;
  Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
  return exports;
}({});
