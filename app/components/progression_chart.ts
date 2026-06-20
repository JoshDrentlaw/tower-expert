// progression_chart.ts — client JS that renders the run-progression charts with
// uPlot (vendored, loaded just before this). Reads window.__progression (points
// + tiers + default tier + i18n, serialized server-side) and builds three line
// charts: Coins/Hour (headline, tier-comparable), Wave (with a tier selector,
// since wave isn't comparable across tiers), and Coins. Each chart shows a hover
// tooltip (run #, date, tier, build, value) and dashed markers where the active
// build changed between consecutive runs. No build step; theme colors are read
// from the page's CSS variables.

export const PROGRESSION_JS = `
(function () {
  var P = window.__progression;
  if (!P || !window.uPlot) return;
  var uPlot = window.uPlot;
  var css = getComputedStyle(document.documentElement);
  function v(name, fb) { var x = (css.getPropertyValue(name) || "").trim(); return x || fb; }
  var accent = v("--accent-text", "#f5a623");
  var line = v("--line", "#2a2a2a");
  var muted = v("--muted", "#9aa0a6");
  var i18n = P.i18n || {};
  var charts = [];

  function fmtMag(n) {
    if (n == null || !isFinite(n)) return "\\u2014";
    var a = Math.abs(n);
    var u = [[1e30,"N"],[1e27,"O"],[1e24,"S"],[1e21,"s"],[1e18,"Q"],[1e15,"q"],[1e12,"T"],[1e9,"B"],[1e6,"M"],[1e3,"K"]];
    for (var i = 0; i < u.length; i++) { if (a >= u[i][0]) return (n / u[i][0]).toFixed(2) + u[i][1]; }
    return (Math.round(n * 100) / 100).toString();
  }
  function fmtInt(n) { return (n == null || !isFinite(n)) ? "\\u2014" : Math.round(n).toLocaleString(); }
  function fmtDate(t) { return new Date(t * 1000).toLocaleString(); }

  function tooltipPlugin(el, meta, fmtY, label) {
    function row(text) { var d = document.createElement("div"); d.textContent = text; return d; }
    return { hooks: { setCursor: function (u) {
      var i = u.cursor.idx;
      if (i == null) { el.style.display = "none"; return; }
      el.innerHTML = "";
      el.appendChild(row("#" + meta.ids[i] + " \\u00b7 " + fmtDate(meta.xs[i])));
      if (meta.tiers[i] != null) el.appendChild(row((i18n.tier || "Tier") + " " + meta.tiers[i]));
      el.appendChild(row(meta.builds[i] != null ? (meta.buildLabels[i] || ("#" + meta.builds[i])) : "\\u2014"));
      el.appendChild(row(label + ": " + fmtY(meta.ys[i])));
      var left = u.valToPos(meta.xs[i], "x");
      var top = u.valToPos(meta.ys[i], "y");
      el.style.display = "block";
      el.style.left = left + "px";
      el.style.top = top + "px";
    } } };
  }

  function makeChart(container, pts, getY, fmtY, label) {
    container.innerHTML = "";
    if (!pts.length) {
      var e = document.createElement("p"); e.className = "hint";
      e.textContent = i18n.noData || "No runs with this metric yet."; container.appendChild(e); return;
    }
    var xs = [], ys = [], ids = [], tiers = [], builds = [], buildLabels = [];
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      xs.push(p.t); ys.push(getY(p)); ids.push(p.id); tiers.push(p.tier);
      builds.push(p.buildId); buildLabels.push(p.buildLabel);
    }
    var meta = { xs: xs, ys: ys, ids: ids, tiers: tiers, builds: builds, buildLabels: buildLabels };
    var tip = document.createElement("div");
    tip.className = "uchart-tip"; tip.style.display = "none";
    container.appendChild(tip);

    function drawMarkers(u) {
      u.ctx.save();
      u.ctx.strokeStyle = muted; u.ctx.setLineDash([3, 3]); u.ctx.lineWidth = 1;
      for (var i = 1; i < builds.length; i++) {
        if (builds[i] !== builds[i - 1]) {
          var x = Math.round(u.valToPos(xs[i], "x", true)) + 0.5;
          u.ctx.beginPath(); u.ctx.moveTo(x, u.bbox.top); u.ctx.lineTo(x, u.bbox.top + u.bbox.height); u.ctx.stroke();
        }
      }
      u.ctx.restore();
    }
    var opts = {
      width: container.clientWidth || 640, height: 200,
      scales: { x: { time: true } },
      series: [ {}, { label: label, stroke: accent, width: 2, points: { show: true, size: 6 } } ],
      axes: [
        { stroke: muted, grid: { stroke: line }, ticks: { stroke: line } },
        { stroke: muted, grid: { stroke: line }, ticks: { stroke: line },
          values: function (u, vals) { return vals.map(fmtY); } },
      ],
      cursor: { points: { size: 8 } },
      hooks: { draw: [drawMarkers] },
      plugins: [ tooltipPlugin(tip, meta, fmtY, label) ],
    };
    container.appendChild(tip);
    var u = new uPlot(opts, [xs, ys], container);
    container.appendChild(tip); // keep tip last so it overlays the canvas
    charts.push({ u: u, el: container });
    return u;
  }

  // --- Coins / Hour (headline) ---
  var cph = document.getElementById("chart-cph");
  if (cph) {
    makeChart(cph, P.points.filter(function (p) { return p.cph != null; }),
      function (p) { return p.cph; }, fmtMag, i18n.cph || "Coins / Hour");
  }

  // --- Cells / Hour ---
  var celph = document.getElementById("chart-celph");
  if (celph) {
    makeChart(celph, P.points.filter(function (p) { return p.celph != null; }),
      function (p) { return p.celph; }, fmtMag, i18n.celph || "Cells / Hour");
  }

  // --- Wave, with a tier selector (wave isn't comparable across tiers) ---
  var waveEl = document.getElementById("chart-wave");
  var tabs = document.getElementById("wave-tiers");
  if (waveEl && tabs) {
    var renderWave = function (tier) {
      var pts = P.points.filter(function (p) { return p.wave != null && p.tier === tier; });
      makeChart(waveEl, pts, function (p) { return p.wave; }, fmtInt, i18n.wave || "Wave");
      var bs = tabs.querySelectorAll("button");
      for (var i = 0; i < bs.length; i++) bs[i].setAttribute("aria-pressed", String(+bs[i].dataset.tier === tier));
    };
    (P.tiers || []).forEach(function (tier) {
      var b = document.createElement("button");
      b.type = "button"; b.className = "tier-tab"; b.dataset.tier = tier;
      b.textContent = (i18n.tier || "Tier") + " " + tier;
      b.addEventListener("click", function () { renderWave(tier); });
      tabs.appendChild(b);
    });
    if (P.defaultTier != null) renderWave(P.defaultTier);
  }

  // --- Coins (total) ---
  var coinsEl = document.getElementById("chart-coins");
  if (coinsEl) {
    makeChart(coinsEl, P.points.filter(function (p) { return p.coins != null; }),
      function (p) { return p.coins; }, fmtMag, i18n.coins || "Coins");
  }

  var t;
  window.addEventListener("resize", function () {
    clearTimeout(t);
    t = setTimeout(function () {
      for (var i = 0; i < charts.length; i++) {
        charts[i].u.setSize({ width: charts[i].el.clientWidth || 640, height: 200 });
      }
    }, 150);
  });
})();
`;
