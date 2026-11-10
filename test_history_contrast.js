"use strict";
const fs = require("node:fs");
const assert = require("node:assert/strict");

const css = fs.readFileSync("web/ai-dark.css", "utf8");
assert.match(css, /\.history-table tbody td\{background:#0b1016;color:#e7edf5\}/);
assert.match(css, /\.history-table tbody tr:nth-child\(even\) td\{background:#111923;color:#e7edf5\}/);
assert.match(css, /\.history-table tbody tr:hover td\{background:#172432;color:#f7fbff\}/);
assert.doesNotMatch(css, /#[0-9a-fA-F]{5}(?![0-9a-fA-F])|#[0-9a-fA-F]{7}(?![0-9a-fA-F])|#[0-9a-fA-F]{9}(?![0-9a-fA-F])/);

function luminance(hex) {
  const rgb = hex.slice(1).match(/.{2}/g).map((value) => parseInt(value, 16) / 255).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
}
function contrast(foreground, background) {
  const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (values[0] + .05) / (values[1] + .05);
}

const ratios = {
  odd: Number(contrast("#e7edf5", "#0b1016").toFixed(2)),
  even: Number(contrast("#e7edf5", "#111923").toFixed(2)),
  hover: Number(contrast("#f7fbff", "#172432").toFixed(2)),
};
assert.ok(Object.values(ratios).every((ratio) => ratio >= 7), JSON.stringify(ratios));
console.log(JSON.stringify({ passed: true, ratios }, null, 2));
