/* Train Buffer risk-logic tests — run: node tests/test_risk.mjs */
import assert from "node:assert";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const R = require("../app/risk.js");

let passed = 0;
function t(name, fn) { fn(); passed++; console.log("ok -", name); }

const BUFFERS = [15, 30, 45, 60, 90, 120, 180, 240, 300, 360];
const pair = { risk: { "15": 0.60, "30": 0.50, "45": 0.44, "60": 0.40, "90": 0.30,
                       "120": 0.22, "180": 0.12, "240": 0.08, "300": 0.05, "360": 0.03 } };

t("riskAt hits grid points exactly", () => {
  assert.equal(R.riskAt(pair, BUFFERS, 60), 0.40);
  assert.equal(R.riskAt(pair, BUFFERS, 120), 0.22);
});

t("riskAt interpolates linearly between grid points", () => {
  const mid = R.riskAt(pair, BUFFERS, 75); // between 60 (0.40) and 90 (0.30)
  assert.ok(Math.abs(mid - 0.35) < 1e-9);
});

t("riskAt clamps outside the grid, never extrapolates", () => {
  assert.equal(R.riskAt(pair, BUFFERS, 5), 0.60);
  assert.equal(R.riskAt(pair, BUFFERS, 720), 0.03);
});

t("risk never increases as the buffer grows", () => {
  let prev = 1;
  for (let b = 15; b <= 360; b += 15) {
    const p = R.riskAt(pair, BUFFERS, b);
    assert.ok(p <= prev + 1e-12, `risk rose at ${b}`);
    prev = p;
  }
});

t("oneInX phrases probabilities as frequencies", () => {
  assert.equal(R.oneInX(0.125), "1 in 8 runs");
  assert.equal(R.oneInX(0.5), "1 in 2 runs");
  assert.equal(R.oneInX(0), null);
  assert.equal(R.oneInX(0.999), "nearly every run");
});

t("verdict flags safe and risky buffers", () => {
  assert.equal(R.verdict(pair, BUFFERS, 300).safe, true);   // p = 0.05
  assert.equal(R.verdict(pair, BUFFERS, 30).risky, true);   // p = 0.50
});

t("survivalPoints starts at zero minutes on the grid", () => {
  const pts = R.survivalPoints(pair, BUFFERS);
  assert.equal(pts[0].x, 0);
  assert.equal(pts.length, BUFFERS.length + 1);
});

console.log(`\n${passed} risk tests passed`);
