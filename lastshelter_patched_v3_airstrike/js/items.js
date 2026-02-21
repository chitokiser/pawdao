/* js/items.js — airstrike & freeze item logic */

// ─── Airstrike ────────────────────────────────────────────────────────────────
function grantAirstrike(n = 1) {
  const before = state.airCharges;
  state.airCharges = clamp(state.airCharges + n, 0, 3);
  if (uiAir) uiAir.textContent = state.airCharges;
  if (state.airCharges > before) showToast("폭격 요청 +1");
}

function spawnAirstrikePickup(x, y) {
  state.pickups.push({ type: "air", x, y, vy: rand(20, 50), bob: rand(0, Math.PI * 2), t: 10.0 });
}

function startAirstrike() {
  if (!state.running || state.paused) return;
  if (state.airCharges <= 0) { showToast("폭격 아이템 없음"); return; }
  if (state.airAnim) return;

  state.airCharges -= 1;
  if (uiAir) uiAir.textContent = state.airCharges;

  const { w, h, roadW } = getRoadBounds();
  const cx   = w / 2;
  const half = roadW * 0.20;
  const victims = [];

  for (let i = 0; i < state.zombies.length; i++) {
    const z = state.zombies[i];
    if (Math.abs(z.x - cx) <= half && z.y > -40 && z.y < h + 80) {
      z._air = true;
      victims.push({ x: z.x, y: z.y });
    }
  }

  state.airAnim = { t: 0, victims, cx, half, phase: "warn", bombs: [], didStrike: false };

  try {
    const s = state.sounds && state.sounds.call;
    if (s) { s.currentTime = 0; s.play().catch(() => {}); }
  } catch (e) {}
  showToast("폭격 요청");
}

function updateAirstrike(dt) {
  if (!state.airAnim) return;
  const a = state.airAnim;
  a.t += dt;

  if (a.t < 0.55) {
    a.phase = "warn";
  } else if (a.t < 0.90) {
    if (a.phase !== "bombs") {
      a.phase = "bombs";
      const { h } = getRoadBounds();
      const list = (a.victims.length > 0) ? a.victims : [{ x: a.cx, y: h * 0.35 }];
      for (let i = 0; i < Math.min(10, list.length); i++) {
        const v = list[Math.floor(rand(0, list.length))];
        a.bombs.push({ x: v.x + rand(-12, 12), y: -60 - rand(0, 120), vy: rand(900, 1200), tx: v.x, ty: v.y });
      }
      try {
        const s = state.sounds && (state.sounds.mg || state.sounds.gun);
        if (s) { s.currentTime = 0; s.play().catch(() => {}); }
      } catch (e) {}
    }
    for (let i = 0; i < a.bombs.length; i++) a.bombs[i].y += a.bombs[i].vy * dt;
  } else {
    a.phase = "strike";
    if (!a.didStrike) {
      a.didStrike = true;
      state.flashT   = 0.18;
      state.shakeTMax= 0.30;
      state.shakeT   = state.shakeTMax;
      state.shakeMag = 11;

      // kill marked zombies
      for (let i = state.zombies.length - 1; i >= 0; i--) {
        const z = state.zombies[i];
        if (z._air) {
          for (let j = 0; j < 3; j++) {
            const ang = rand(0, Math.PI * 2);
            const spd = rand(40, 140);
            state.particles.push({ x: z.x, y: z.y, vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd, r: rand(1,2.5), t: rand(0.2,0.5) });
          }
          state.zombies.splice(i, 1);
        }
      }
      for (let i = 0; i < Math.min(5, a.bombs.length); i++) {
        explode(a.bombs[i].tx, a.bombs[i].ty, 80, 999999);
      }
      if (a.bombs.length === 0) explode(a.cx, getRoadBounds().h * 0.5, 80, 999999);

      for (let i = 0; i < state.zombies.length; i++) state.zombies[i]._air = false;
    }
    if (a.t > 1.25) {
      state.airAnim = null;
      // 폭격 중 재생된 mg/gun 루프 사운드 정지
      try {
        const mg = state.sounds && state.sounds.mg;
        if (mg && !mg.paused) { mg.pause(); mg.currentTime = 0; }
      } catch (e) {}
    }
  }
}

// ─── Freeze ───────────────────────────────────────────────────────────────────
function spawnFreezePickup(x, y) {
  state.pickups.push({ type: "freeze", x, y, vy: rand(20, 50), bob: rand(0, Math.PI * 2), t: 10.0 });
}

function useFreeze() {
  if (!state.running || state.paused) return;
  if (state.freezeCharges <= 0) { showToast("프리즈 아이템 없음"); return; }
  state.freezeCharges -= 1;
  state.freezeT = 5.0;
  if (uiFreeze) uiFreeze.textContent = state.freezeCharges;
  showToast("❄ 프리즈!");
}
