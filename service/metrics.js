/* ============================================================
   Potential Threat · TornierService 业务埋点
   只读应用暴露的 window.PT 状态，不改游戏逻辑。
   上报：玩家点数（排行）、当前阶段、攻陷主机数。
   由应用仓库自带，位于 service/metrics.js。
   ============================================================ */
(function () {
  'use strict';
  var S = window.TornierService;
  if (!S) return;

  var who = S.uid.slice(-6).toUpperCase();      // 匿名短号，用于点数排行
  var lastStage = null, lastPoints = -1;

  function report() {
    var g = window.PT;
    if (!g || g.state === 'title') return;       // 还没开始游戏

    var points = Math.floor(Number(g.tokens) || 0);
    if (points !== lastPoints) {
      S.event('score', { player: who, points: points, name: 'PT', score: points });
      lastPoints = points;
    }
    var stage = 'STAGE ' + (Number(g.stageIndex) + 1);
    if (stage !== lastStage) {
      S.event('tier', { name: stage, value: Number(g.stageIndex) + 1 });
      lastStage = stage;
    }
    if (g.compromised != null) {
      S.event('metric', { name: 'compromised hosts', value: Number(g.compromised) || 0 });
    }
  }

  // 游戏状态变化不触发 DOM 事件，用低频轮询（每 10s）读取即可
  setInterval(report, 10000);
  window.addEventListener('pagehide', report);
  setTimeout(report, 3000);
})();
