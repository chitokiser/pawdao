/* js/core.js — canvas, DOM refs, utility functions */

const canvas = document.getElementById("c");
const ctx = canvas.getContext("2d", { alpha: false });
const DPR = Math.min(2, window.devicePixelRatio || 1);

// HUD elements
const uiStage  = document.getElementById("uiStage");
const uiAllies = document.getElementById("uiAllies");
const uiDps    = document.getElementById("uiDps");
const uiAir      = document.getElementById("uiAir");
const uiFreeze   = document.getElementById("uiFreeze");
const uiClaymore = document.getElementById("uiClaymore");

// Buttons
const btnPause   = document.getElementById("btnPause");
const btnAir     = document.getElementById("btnAir");
const btnFreeze  = document.getElementById("btnFreeze");
const btnRestart = document.getElementById("btnRestart");

// Overlay
const overlay  = document.getElementById("overlay");
const btnStart = document.getElementById("btnStart");
const ovTitle  = document.getElementById("ovTitle");
const ovDesc   = document.getElementById("ovDesc");

const toast = document.getElementById("toast");

// ─── Canvas resize ───────────────────────────────────────────────────────────
function fit() {
  const rect = canvas.getBoundingClientRect();
  canvas.width  = Math.floor(rect.width  * DPR);
  canvas.height = Math.floor(rect.height * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}
window.addEventListener("resize", fit);

// ─── Math helpers ─────────────────────────────────────────────────────────────
function rand(a, b)      { return a + Math.random() * (b - a); }
function clamp(v, a, b)  { return Math.max(a, Math.min(b, v)); }
function lerp(a, b, t)   { return a + (b - a) * t; }

// ─── Toast ───────────────────────────────────────────────────────────────────
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove("show"), 900);
}

// ─── Sprite helpers ──────────────────────────────────────────────────────────
function drawImageAnchored(img, x, y, w, h, ax = 0.5, ay = 0.5, alpha = 1) {
  if (!img || !img.complete) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, x - w * ax, y - h * ay, w, h);
  ctx.restore();
}

function drawImageAnchoredRot(img, x, y, w, h, ax = 0.5, ay = 0.5, rot = 0, alpha = 1) {
  if (!img || !img.complete) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.drawImage(img, -w * ax, -h * ay, w, h);
  ctx.restore();
}
