/* js/main.js — input, UI, game loop, boot */

// ─── Input ────────────────────────────────────────────────────────────────────
let dragging = false;

function pointerPos(e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.touches ? e.touches[0].clientX : e.clientX) - rect.left;
  const y = (e.touches ? e.touches[0].clientY : e.clientY) - rect.top;
  return { x, y, rect };
}

function onDown(e) {
  dragging = true;
  const { x, y, rect } = pointerPos(e);
  state.targetX = x - rect.width / 2;
  state.targetY = y;
  if (!state.running) startGame();
}
function onMove(e) {
  if (!dragging) return;
  const { x, y, rect } = pointerPos(e);
  state.targetX = x - rect.width / 2;
  state.targetY = y;
}
function onUp() { dragging = false; }

canvas.addEventListener("mousedown", onDown);
window.addEventListener("mousemove", onMove);
window.addEventListener("mouseup",   onUp);

canvas.addEventListener("touchstart", (e) => { e.preventDefault(); onDown(e); }, { passive: false });
canvas.addEventListener("touchmove",  (e) => { e.preventDefault(); onMove(e); }, { passive: false });
canvas.addEventListener("touchend",   (e) => { e.preventDefault(); onUp(e);   }, { passive: false });

const keys = new Set();
window.addEventListener("keydown", (e) => {
  keys.add(e.key);
  if (e.code === "Space")  { e.preventDefault(); state.isFiring = true; }
  if (e.code === "KeyF")   { e.preventDefault(); startAirstrike(); }
  if (e.code === "KeyS" && !e.repeat) { e.preventDefault(); keys.delete(e.key); useFreeze(); }
});
window.addEventListener("keyup", (e) => {
  keys.delete(e.key);
  if (e.code === "Space") { state.isFiring = false; }
});

// ─── 모바일 발사 버튼 (토글: 한 번 누르면 자동 발사 ON, 다시 누르면 OFF) ────
const btnFire = document.getElementById("btnFire");
function setAutoFire(on) {
  state.isFiring = on;
  if (btnFire) btnFire.classList.toggle("active", on);
}
if (btnFire) {
  const toggle = (e) => {
    e.preventDefault();
    if (!state.running) { startGame(); return; }
    setAutoFire(!state.isFiring);
  };
  btnFire.addEventListener("touchstart", toggle, { passive: false });
  btnFire.addEventListener("mousedown",  toggle);
}

// ─── UI helpers ───────────────────────────────────────────────────────────────
function stopGunSound() {
  try {
    const s = state.sounds && (state.sounds.gun || state.sounds.mg);
    if (s && !s.paused) s.pause();
  } catch (e) {}
}

btnPause.addEventListener("click", () => {
  if (!state.running) return;
  state.paused = !state.paused;
  btnPause.textContent = state.paused ? "resume" : "pause";
  showToast(state.paused ? "일시정지" : "재개");
  if (state.paused) { stopGunSound(); setAutoFire(false); }
});

btnRestart.addEventListener("click", () => {
  setAutoFire(false);
  reset();
  overlay.classList.remove("hidden");
  ovTitle.textContent = "ready";
  ovDesc.textContent  = "click / tap to start";
  btnPause.textContent = "pause";
});

if (btnAir)    btnAir.addEventListener("click",    () => startAirstrike());
if (btnFreeze) btnFreeze.addEventListener("click", () => useFreeze());

btnStart.addEventListener("click", startGame);

function startGame() {
  if (!state.assetsReady) return;
  reset();
  overlay.classList.add("hidden");
  state.running = true;
  state.paused  = false;
  btnPause.textContent = "pause";
  showToast("start");

  const { top, bottom } = getRoadBounds();
  state.leaderY = lerp(top, bottom, 0.9);
  state.targetY = state.leaderY;

  spawnWave();
}

// ─── Game loop ────────────────────────────────────────────────────────────────
let last = performance.now();

function tick(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;
  fitIfNeeded();
  update(dt);
  render();
  requestAnimationFrame(tick);
}

let _fitInited = false;
function fitIfNeeded() {
  if (!_fitInited) { fit(); _fitInited = true; }
}

// ─── END 버튼 (온체인 점수 저장) ───────────────────────────────────────────────
const endUI = { btn: null, badge: null };

function getReturnUrl() {
  const p = new URLSearchParams(location.search);
  const ret = p.get("return");
  if (ret) {
    try { return decodeURIComponent(ret); } catch { return ret; }
  }
  return "../offchain.html";
}

function updateScoreBadge() {
  const s = String(state.score || 0);
  if (endUI.badge) endUI.badge.textContent = s;
  const uiScore = document.getElementById("uiScore");
  if (uiScore) uiScore.textContent = s;
}

function setupEndButton() {
  const style = document.createElement("style");
  style.textContent = `
    .shelter-end {
      position: fixed;
      right: 14px;
      bottom: 14px;
      z-index: 9999;
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 10px 14px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,.18);
      background: rgba(0,0,0,.50);
      color: #eaf1ff;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      user-select: none;
      backdrop-filter: blur(6px);
      letter-spacing: .04em;
    }
    .shelter-end .badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 10px;
      border-radius: 999px;
      border: 1px solid rgba(255,255,255,.14);
      background: rgba(255,255,255,.08);
      font-weight: 900;
    }
  `;
  document.head.appendChild(style);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "shelter-end";
  btn.innerHTML = `<span>END</span><span class="badge" id="shelterEndBadge">0</span>`;
  document.body.appendChild(btn);

  endUI.btn   = btn;
  endUI.badge = btn.querySelector("#shelterEndBadge");
  updateScoreBadge();

  btn.addEventListener("click", async () => {
    const score  = Number(state.score || 0);
    const qs     = new URLSearchParams(location.search);
    const gameId = qs.get("game") || "lastshelter";
    const nonce  = qs.get("nonce") || "";

    if (!nonce) {
      alert("nonce 없음: offchain에서 joinGame부터 하세요.");
      return;
    }

    const address = window.ethereum?.selectedAddress;
    if (!address) {
      alert("지갑 주소 없음: Rabby/MetaMask 연결을 확인하세요.");
      return;
    }
    if (!window.ethereum?.request) {
      alert("지갑 provider가 없습니다.");
      return;
    }

    const payload = `PAW_OFFCHAIN|${gameId}|${address}|${nonce}|${score}`;

    let sig = "";
    try {
      sig = await window.ethereum.request({
        method: "personal_sign",
        params: [payload, address],
      });
    } catch (_e) {
      alert("서명이 취소되었습니다.");
      return;
    }

    // localStorage 백업 (디버그용)
    localStorage.setItem("paw_score_lastshelter", String(score));
    localStorage.setItem("paw_sig_lastshelter",   sig);
    localStorage.setItem("paw_payload_lastshelter", payload);

    const ret = getReturnUrl();
    const url = new URL(ret, location.href);
    url.searchParams.set("game",    gameId);
    url.searchParams.set("score",   String(score));
    url.searchParams.set("sig",     sig);
    url.searchParams.set("payload", payload);

    location.href = url.toString();
  });
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
function boot() {
  reset();
  fit();

  overlay.classList.remove("hidden");
  ovTitle.textContent   = "loading";
  ovDesc.textContent    = "assets loading...";
  btnStart.disabled     = true;

  Promise.all([loadImages(), loadSounds()]).then(() => {
    state.assetsReady     = true;
    ovTitle.textContent   = "ready";
    ovDesc.textContent    = "click / tap to start";
    btnStart.disabled     = false;
  }).catch(() => {
    state.assetsReady     = true;
    ovTitle.textContent   = "ready";
    ovDesc.textContent    = "click / tap to start";
    btnStart.disabled     = false;
  });

  requestAnimationFrame(tick);
}

setupEndButton();
boot();
