/* Train Buffer pure logic — risk interpolation + phrasing.
   Shared by the browser app and the node tests. */
(function (root) {
  "use strict";

  /* Empirical P(delay > buffer) from the shipped grid, linearly
     interpolated between grid points. Buffers outside the grid clamp
     to the nearest grid value — never extrapolated. */
  function riskAt(pair, buffers, bufferMin) {
    var grid = buffers, risk = pair.risk;
    if (bufferMin <= grid[0]) return risk[String(grid[0])];
    if (bufferMin >= grid[grid.length - 1]) return risk[String(grid[grid.length - 1])];
    for (var i = 0; i < grid.length - 1; i++) {
      var a = grid[i], b = grid[i + 1];
      if (bufferMin >= a && bufferMin <= b) {
        var pa = risk[String(a)], pb = risk[String(b)];
        return pa + (pb - pa) * ((bufferMin - a) / (b - a));
      }
    }
    return risk[String(grid[grid.length - 1])];
  }

  /* Survival curve points for the terrain: [{x: minutes, y: P(>x)}],
     starting at (0, P(>0)) approximated by the first grid value —
     labelled as grid-based in the UI, never drawn smoother than data. */
  function survivalPoints(pair, buffers) {
    var pts = [{ x: 0, y: pair.risk[String(buffers[0])] }];
    buffers.forEach(function (b) { pts.push({ x: b, y: pair.risk[String(b)] }); });
    return pts;
  }

  function oneInX(p) {
    if (!isFinite(p) || p <= 0) return null;
    if (p >= 0.995) return "nearly every run";
    var x = Math.round(1 / p);
    if (x <= 1) return "nearly every run";
    return "1 in " + x + " runs";
  }

  function verdict(pair, buffers, bufferMin) {
    var p = riskAt(pair, buffers, bufferMin);
    return {
      p: p,
      pct: Math.round(p * 100),
      phrase: oneInX(p),
      safe: p <= 0.05,
      risky: p > 0.20
    };
  }

  var api = { riskAt: riskAt, survivalPoints: survivalPoints, oneInX: oneInX, verdict: verdict };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  root.TrainBufferRisk = api;
})(typeof window !== "undefined" ? window : globalThis);
