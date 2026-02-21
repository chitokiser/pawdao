/* js/update.js — main game update loop */

function update(dt) {
  const { w, h, roadW, top, bottom, left, right } = getRoadBounds();
  if (!state.running || state.paused) return;

  state.time += dt;

  updateAirstrike(dt);

  // flash decay
  if (state.flashT > 0) { state.flashT -= dt; if (state.flashT < 0) state.flashT = 0; }

  // freeze timer
  if (state.freezeT > 0)     { state.freezeT -= dt;     if (state.freezeT < 0) state.freezeT = 0; }
  if (state.freezeDropCd > 0){ state.freezeDropCd -= dt; if (state.freezeDropCd < 0) state.freezeDropCd = 0; }

  // pickup drop cooldown
  if (state.airDropCd > 0)   { state.airDropCd -= dt;   if (state.airDropCd < 0) state.airDropCd = 0; }

  // die sound cooldown
  if (state.dieSoundCd > 0)  { state.dieSoundCd -= dt;  if (state.dieSoundCd < 0) state.dieSoundCd = 0; }

  // 무적 타이머
  if (state.iframes > 0)     { state.iframes -= dt;     if (state.iframes < 0) state.iframes = 0; }

  // camera shake decay
  if (state.shakeT > 0)      { state.shakeT -= dt;      if (state.shakeT < 0) state.shakeT = 0; }

  // ambient smoke
  state.smokeAcc += dt * TUNE.smokeSpawnPerSec;
  while (state.smokeAcc >= 1) {
    state.smokeAcc -= 1;
    const x = rand(left + 20, right - 20);
    const y = rand(bottom - 10, h + 40);
    state.smokes.push({ x, y, vx: rand(-10,10), vy: rand(-50,-20), r: rand(10,20), t: rand(1.2,2.3), a: rand(0.06,0.12) });
  }

  // movement (S 키는 freeze 전용이므로 이동에서 제외)
  const maxX = roadW * 0.42;
  let kx = 0, ky = 0;
  if (keys.has("ArrowLeft")  || keys.has("a")) kx -= 1;
  if (keys.has("ArrowRight") || keys.has("d")) kx += 1;
  if (keys.has("ArrowUp")    || keys.has("w")) ky -= 1;
  if (keys.has("ArrowDown"))                   ky += 1;

  const usingKeyboard = (kx !== 0 || ky !== 0);
  if (usingKeyboard) {
    const len = Math.hypot(kx, ky) || 1;
    state.leaderX += (kx / len) * state.moveSpeed * dt;
    state.leaderY += (ky / len) * state.moveSpeed * dt;
    state.targetX = state.leaderX;
    state.targetY = state.leaderY;
  } else {
    state.leaderX = lerp(state.leaderX, state.targetX, 0.18);
    state.leaderY = lerp(state.leaderY, state.targetY, 0.20);
  }
  state.leaderX = clamp(state.leaderX, -maxX, maxX);
  state.leaderY = clamp(state.leaderY, top, bottom);

  autoShoot(dt);

  // bullets
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.ttl -= dt;
    if (b.ttl <= 0 || b.y < -80 || b.y > h + 80 || b.x < -80 || b.x > w + 80) state.bullets.splice(i, 1);
  }

  // zombies (원근 + X 수렴 + 프리즈)
  const zombieCX = (left + right) / 2;
  const spawnZone = top - 480;
  for (let i = state.zombies.length - 1; i >= 0; i--) {
    const z = state.zombies[i];
    if (state.freezeT <= 0) z.y += z.spd * dt;

    const depthT = clamp((z.y - spawnZone) / (bottom - spawnZone), 0, 1);
    z.x = lerp(zombieCX, z.targetX, depthT) + Math.sin(state.time * 6 + z.swaySeed) * 0.10 * depthT;
    z.scale = lerp(0.04, 1.35, depthT);
    z.size  = z.baseSize * z.scale;
    z.hitR  = z.size * TUNE.zombieHitMul;

    if (z.y > h + 90) state.zombies.splice(i, 1);
  }

  // boss (원근 + 프리즈)
  if (state.boss) {
    const b = state.boss;
    if (state.freezeT <= 0) b.y += b.spd * dt;
    b.stompT += dt;
    b.walkT  += dt;

    const bossSpawnZone = top - 500;
    const bossDepthT = clamp((b.y - bossSpawnZone) / (bottom - bossSpawnZone), 0, 1);
    b.scale = lerp(0.04, 1.0, bossDepthT);
    b.size  = b.baseSize * b.scale;
    b.hitR  = b.size * TUNE.bossHitMul;

    if (b.stompT > 2.8) {
      b.stompT = 0;
      explode(b.x, b.y + b.size * 0.2, 90, state.baseDmg * 6);
      state.shakeTMax = 0.20;
      state.shakeT    = state.shakeTMax;
      state.shakeMag  = 7 + Math.min(6, state.stage);
    }

    if (b.y > 170) b.spd = 36 + state.stage * 3;

    if (b.y > h * 0.90) {
      state.running = false;
      stopGunSound();
      overlay.classList.remove("hidden");
      ovTitle.textContent = "overrun";
      ovDesc.textContent  = "restart to try again";
    }
  }

  bulletCollisions();
  contactDeaths();

  // pickups
  const px = w / 2 + state.leaderX;
  const py = state.leaderY;
  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const p = state.pickups[i];
    p.y += p.vy * dt;
    p.vy *= 0.985;
    p.t  -= dt;

    const d = Math.hypot(p.x - px, p.y - py);
    if (d < 34) {
      try {
        const s = state.sounds && state.sounds.get;
        if (s) { s.currentTime = 0; s.play().catch(() => {}); }
      } catch (e) {}
      state.pickups.splice(i, 1);
      if (p.type === "freeze") {
        state.freezeCharges = Math.min(5, state.freezeCharges + 1);
        if (uiFreeze) uiFreeze.textContent = state.freezeCharges;
        showToast("❄ 프리즈 아이템 획득");
      } else if (p.type === "claymore") {
        state.claymoreCharges = Math.min(5, state.claymoreCharges + 1);
        if (uiClaymore) uiClaymore.textContent = state.claymoreCharges;
        showToast("💣 클레모어 획득");
      } else {
        grantAirstrike(1);
      }
      continue;
    }
    if (p.t <= 0 || p.y > h + 80) state.pickups.splice(i, 1);
  }

  // gate spawn
  state.gateCooldown -= dt;
  if (!state.gate && state.gateCooldown <= 0 && state.time > 2.0) {
    if (state.zombies.length < 28 && (!state.boss || state.boss.hp < state.boss.maxHp * 0.85)) {
      spawnGate();
    }
  }

  // gate update (원근)
  if (state.gate) {
    const g = state.gate;
    g.y += g.speed * dt;

    const gSpawnZone = top - 480;
    const depthT = clamp((g.y - gSpawnZone) / (bottom - gSpawnZone), 0, 1);
    g.scale = lerp(0.04, 1.0, depthT);
    g.effW  = g.baseW * g.scale;
    g.effH  = g.baseH * g.scale;

    const cx      = w / 2;
    const halfGap = 90 * g.scale;
    g.leftX  = cx - halfGap - g.effW / 2;
    g.leftY  = g.y - g.effH / 2;
    g.rightX = cx + halfGap - g.effW / 2;
    g.rightY = g.y - g.effH / 2;

    if (g.y > h + 120) { state.gate = null; state.gateCooldown = 11.0; }
    if (state.gate && g.leftDead && g.rightDead) { state.gate = null; state.gateCooldown = 12.5; }
  }

  // muzzle flashes
  for (let i = state.muzzleFlashes.length - 1; i >= 0; i--) {
    state.muzzleFlashes[i].t -= dt;
    if (state.muzzleFlashes[i].t <= 0) state.muzzleFlashes.splice(i, 1);
  }

  // particles
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= Math.pow(0.001, dt); p.vy *= Math.pow(0.001, dt);
    p.t -= dt;
    if (p.t <= 0) state.particles.splice(i, 1);
  }

  // smokes
  for (let i = state.smokes.length - 1; i >= 0; i--) {
    const s = state.smokes[i];
    s.x += s.vx * dt; s.y += s.vy * dt;
    s.vx *= 0.995; s.vy *= 0.995;
    s.r += dt * 8; s.t -= dt;
    if (s.t <= 0) state.smokes.splice(i, 1);
  }

  // next stage
  if (state.zombies.length === 0 && !state.gate && !state.boss) {
    state.stage += 1;
    uiStage.textContent = state.stage;
    showToast(`stage ${state.stage}`);
    if (state.stage % 2 === 0) state.allies += 1;
    uiAllies.textContent = state.allies;
    uiDps.textContent = Math.round(state.allies * state.baseDmg * state.fireRate);
    spawnWave();
  }
}
