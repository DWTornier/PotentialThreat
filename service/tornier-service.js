/* ============================================================
   TornierService · client v1
   通用「服务 / 玩家 / 用户」追踪 SDK —— 不依赖任何主站、可部署到任意站点。

   接入（把本文件复制到项目的 service/ 目录，index.html 加一行）：
     <script src="./service/tornier-service.js"
             data-service="my-app"
             data-endpoint="https://host.example/api/service/event" defer></script>
   data-endpoint 省略时用同源 /api/service/event（适合应用与 API 同站部署）。
   跨站上报时服务端需允许 CORS —— 见 server/route.js。

   自动：页面浏览、30s 活跃心跳、匿名设备 ID、地区（服务端读 CF-IPCountry）。
   业务指标：TornierService.event('score', {player:'p1', points:1234})
   零 JS： <span data-ts-metric="score" data-ts-player="p1">1234</span>
           <button data-ts-event="preset" data-ts-name="golden-ratio">
   契约见 ../contract.md
   ============================================================ */
(function () {
  'use strict';

  var el = document.currentScript;
  var SERVICE = (el && el.getAttribute('data-service')) || window.TORNIER_SERVICE_KEY || '';
  if (!SERVICE) return;

  var ENDPOINT = (el && el.getAttribute('data-endpoint')) || '/api/service/event';
  var AUTO_PARAMS = el && el.getAttribute('data-ts-autoparams') === '1';
  var HB_MS = 30000;
  var uid = (function () {
    var v = '';
    try { v = localStorage.getItem('tornier-vid') || ''; } catch (e) { }
    if (!v) {
      v = 'v-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
      try { localStorage.setItem('tornier-vid', v); } catch (e) { }
    }
    return v;
  })();

  function send(kind, payload, beacon) {
    var body = JSON.stringify({
      service: SERVICE, kind: String(kind || 'event').slice(0, 40), uid: uid,
      path: location.pathname, payload: payload || {}
    });
    try {
      if (beacon && navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, new Blob([body], { type: 'application/json' }));
        return;
      }
      fetch(ENDPOINT, {
        method: 'POST', keepalive: true, mode: 'cors',
        headers: { 'Content-Type': 'application/json' }, body: body
      }).catch(function () { });
    } catch (e) { }
  }

  var API = {
    version: 1, service: SERVICE, uid: uid, endpoint: ENDPOINT,
    event: function (kind, payload) { send(kind, payload); },
    track: function (kind, payload) { send(kind, payload); },
    metric: function (name, value) { send('metric', { name: name, value: value }); },
    setUser: function (id, extra) { send('session', { user: String(id).slice(0, 64), extra: extra || {} }); },
    heartbeat: function () { send('heartbeat'); }
  };
  window.TornierService = API;

  send('pageview');
  API.heartbeat();
  setInterval(function () { if (!document.hidden) API.heartbeat(); }, HB_MS);
  document.addEventListener('visibilitychange', function () { send('heartbeat', {}, true); });
  window.addEventListener('pagehide', function () { send('heartbeat', {}, true); });

  if (AUTO_PARAMS) {
    var last = 0;
    document.addEventListener('change', function (e) {
      var n = e.target;
      if (!n || !/^(INPUT|SELECT|TEXTAREA)$/.test(n.tagName)) return;
      var name = n.getAttribute('data-ts-param') || n.name || n.id;
      if (!name || n.type === 'password' || n.type === 'file') return;
      var now = Date.now(); if (now - last < 800) return; last = now;
      API.event('param', { name: String(name).slice(0, 60), value: String(n.value ?? '').slice(0, 60) });
    }, true);
  }

  document.addEventListener('click', function (e) {
    var n = e.target && e.target.closest && e.target.closest('[data-ts-event]');
    if (!n) return;
    API.event(n.getAttribute('data-ts-event'), {
      name: n.getAttribute('data-ts-name') || '', value: n.getAttribute('data-ts-value') || ''
    });
  }, true);

  function readMetrics() {
    document.querySelectorAll('[data-ts-metric]').forEach(function (n) {
      var kind = n.getAttribute('data-ts-metric');
      var v = Number(String(n.textContent || '').replace(/[^\d.\-]/g, ''));
      if (!kind || !Number.isFinite(v)) return;
      API.event(kind, {
        player: n.getAttribute('data-ts-player') || n.getAttribute('data-ts-name') || '',
        name: n.getAttribute('data-ts-name') || '', points: v, score: v
      });
    });
  }
  var lastMetric = 0;
  if (window.MutationObserver) {
    new MutationObserver(function () {
      var now = Date.now(); if (now - lastMetric < 5000) return;
      lastMetric = now; readMetrics();
    }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  }
  setTimeout(readMetrics, 1500);

  window.dispatchEvent(new CustomEvent('tornier-service:ready', { detail: API }));
})();
