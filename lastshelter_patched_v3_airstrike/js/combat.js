/* js/combat.js — shooting, collisions, explosions, kill */

// ─── Effects ──────────────────────────────────────────────────────────────────
function burstTurret() {
  const { w } = getRoadBounds();
  const px = w / 2 + state.leaderX;
  const py = state.leaderY;
  for (let i = 0; i < 14; i++) {
    const ang = -Math.PI / 2 + rand(-0.55, 0.55);
    const spd = 860 + rand(-80, 80);
    state.bullets.push({ x: px, y: py - 10, vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd, dmg: state.baseDmg * 1.2, r: 2.2, ttl: 1.2, pierce: 2 });
  }
}

function airStrike() {
  const { left, right } = getRoadBounds();
  for (let i = 0; i < 6; i++) {
    explode(rand(left + 30, right - 30), rand(80, 260), 70, state.baseDmg * 18);
  }
}

function explode(x, y, radius, dmg) {
  for (let i = state.zombies.length - 1; i >= 0; i--) {
    const z = state.zombies[i];
    const d = Math.hypot(z.x - x, z.y - y);
    if (d <= radius + z.hitR) {
      z.hp -= dmg * (1 - d / (radius + z.hitR));
      if (z.hp <= 0) killZombie(i, z, 10);
    }
  }

  if (state.boss) {
    const b = state.boss;
    const d = Math.hypot(b.x - x, (b.y + b.size * 0.1) - y);
    if (d < radius + b.hitR + 50) {
      b.hp -= dmg * 0.55;
      if (b.hp <= 0) {
        state.boss = null;
        const bonus = 100;
        state.score += bonus;
        if (typeof updateScoreBadge === 'function') updateScoreBadge();
        showToast(`boss 처치 +${bonus}`);
      }
    }
  }

  const pCount = 26;
  for (let i = 0; i < pCount; i++) {
    const a = rand(0, Math.PI * 2);
    const s = rand(60, 260);
    state.particles.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, r: rand(1.5, 3.5), t: rand(0.25, 0.7) });
  }
  for (let i = 0; i < 8; i++) {
    const a = rand(0, Math.PI * 2);
    const s = rand(20, 80);
    state.smokes.push({ x, y, vx: Math.cos(a)*s, vy: Math.sin(a)*s - rand(10,40), r: rand(10,24), t: rand(0.8,1.4), a: rand(0.22,0.34) });
  }
  try {
    const s = state.sounds && state.sounds.boom;
    if (s) { s.currentTime = 0; s.play().catch(() => {}); }
  } catch (e) {}
}

function killZombie(idx, z, pcount = 6) {
  state.zombies.splice(idx, 1);

  // 점수: 좀비 1마리 = 1점
  const gain = 1;
  state.score     += gain;
  state.killCount += 1;
  if (typeof updateScoreBadge === 'function') updateScoreBadge();

  try {
    if (state.dieSoundCd <= 0) {
      const s = state.sounds && state.sounds.die;
      if (s) { s.currentTime = 0; s.play().catch(() => {}); }
      state.dieSoundCd = 0.65;
    }
  } catch (e) {}

  for (let j = 0; j < pcount; j++) {
    const a = rand(0, Math.PI * 2);
    const s = rand(30, 160);
    state.particles.push({ x: z.x, y: z.y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, r: rand(1, 2.8), t: rand(0.2, 0.55) });
  }
  state.smokes.push({ x: z.x, y: z.y, vx: rand(-20,20), vy: rand(-40,-20), r: rand(14,22), t: rand(0.9,1.6), a: rand(0.18,0.28) });

  // drop airstrike item
  if (state.airCharges < 3 && state.airDropCd <= 0 && Math.random() < 0.035) {
    spawnAirstrikePickup(z.x, z.y);
    state.airDropCd = 3.6;
  }
  // drop freeze item
  if (state.freezeCharges < 3 && state.freezeDropCd <= 0 && Math.random() < 0.05) {
    spawnFreezePickup(z.x, z.y);
    state.freezeDropCd = 4.0;
  }
}

// ─── Manual fire toward vanishing point ──────────────────────────────────────
// 총알은 소실점(w/2, top)을 향해 직선 발사.
// 스페이스바 / 발사 버튼을 누르는 동안만 발사.
let shootAcc = 0;

function autoShoot(dt) {
  const hasEnemies = state.zombies.length > 0 || !!state.boss;

  // 총소리: 발사 중 AND 적이 있을 때만 재생, 그 외 항상 정지
  try {
    const s = state.sounds && (state.sounds.gun || state.sounds.mg);
    if (s) {
      if (state.isFiring && hasEnemies) {
        if (s.paused) s.play().catch(() => {});
      } else {
        if (!s.paused) s.pause();
      }
    }
  } catch (e) {}

  if (!state.isFiring) return;

  shootAcc += dt;
  const interval = 1 / state.fireRate;
  const { w, top } = getRoadBounds();

  // 소실점 좌표
  const vpX = w / 2;
  const vpY = top;

  const alliesPos = getAllyPositions();
  while (shootAcc >= interval) {
    shootAcc -= interval;
    for (let i = 0; i < alliesPos.length; i++) {
      const p   = alliesPos[i];
      // 각 아군 → 소실점 방향으로 발사 + 미세 스프레드
      const ang = Math.atan2(vpY - p.y, vpX - p.x) + rand(-state.spread * 0.5, state.spread * 0.5);
      const spd = state.bulletSpeed;
      state.bullets.push({ x: p.x, y: p.y - 10, vx: Math.cos(ang)*spd, vy: Math.sin(ang)*spd, dmg: state.baseDmg, r: 2.0, ttl: 1.25, pierce: 1 });
      state.muzzleFlashes.push({ x: p.x, y: p.y - 10, ang, t: 0.09 });
    }
  }
}

// ─── Bullet collisions ────────────────────────────────────────────────────────
function bulletCollisions() {
  const { h } = getRoadBounds();

  for (let bi = state.bullets.length - 1; bi >= 0; bi--) {
    const b = state.bullets[bi];
    let hit = false;

    for (let zi = state.zombies.length - 1; zi >= 0; zi--) {
      const z  = state.zombies[zi];
      const dx = z.x - b.x, dy = z.y - b.y;
      const rr = z.hitR + b.r;
      if (dx*dx + dy*dy <= rr*rr) {
        z.hp -= b.dmg;
        hit = true;
        state.particles.push({ x: b.x, y: b.y, vx: rand(-40,40), vy: rand(-40,40), r: rand(1,2.5), t: rand(0.08,0.18) });
        if (z.hp <= 0) killZombie(zi, z, 7);
        b.pierce -= 1;
        if (b.pierce <= 0) break;
      }
    }

    if (state.boss && b.pierce > 0) {
      const boss = state.boss;
      const dx = boss.x - b.x, dy = (boss.y + boss.size * 0.1) - b.y;
      const rr = boss.hitR + b.r;
      if (dx*dx + dy*dy <= rr*rr) {
        boss.hp -= b.dmg;
        hit = true;
        state.particles.push({ x: b.x, y: b.y, vx: rand(-50,50), vy: rand(-50,50), r: rand(1,3), t: rand(0.08,0.2) });
        b.pierce = 0;
        if (boss.hp <= 0) {
          state.boss = null;
          const bonus = 100;
          state.score += bonus;
          if (typeof updateScoreBadge === 'function') updateScoreBadge();
          showToast(`boss 처치 +${bonus}`);
        }
      }
    }

    // card hit
    if (state.gate && b.pierce > 0) {
      const g = state.gate;
      const checkCard = (cx, cy, cw, ch, isLeft) => {
        if (b.x >= cx && b.x <= cx + cw && b.y >= cy && b.y <= cy + ch) {
          if (isLeft && !g.leftDead) {
            g.leftHp -= b.dmg; hit = true; b.pierce = 0;
            state.particles.push({ x: b.x, y: b.y, vx: rand(-30,30), vy: rand(-30,30), r: rand(1,2), t: rand(0.1,0.2) });
            if (g.leftHp <= 0) {
              g.leftDead = true; g.leftOpt.apply();
              showToast(`획득: ${g.leftOpt.label}`);
              uiAllies.textContent = state.allies;
              uiDps.textContent = Math.round(state.allies * state.baseDmg * state.fireRate);
            }
          } else if (!isLeft && !g.rightDead) {
            g.rightHp -= b.dmg; hit = true; b.pierce = 0;
            state.particles.push({ x: b.x, y: b.y, vx: rand(-30,30), vy: rand(-30,30), r: rand(1,2), t: rand(0.1,0.2) });
            if (g.rightHp <= 0) {
              g.rightDead = true; g.rightOpt.apply();
              showToast(`획득: ${g.rightOpt.label}`);
              uiAllies.textContent = state.allies;
              uiDps.textContent = Math.round(state.allies * state.baseDmg * state.fireRate);
            }
          }
        }
      };
      checkCard(g.leftX,  g.leftY,  g.effW, g.effH, true);
      if (b.pierce > 0) checkCard(g.rightX, g.rightY, g.effW, g.effH, false);
    }

    if (b.y > h + 60) b.pierce = 0;
    if (hit && b.pierce <= 0) state.bullets.splice(bi, 1);
  }
}

// ─── Contact deaths ───────────────────────────────────────────────────────────
function contactDeaths() {
  const alliesPos = getAllyPositions();
  if (alliesPos.length === 0) return;
  const { top, bottom } = getRoadBounds();
  let hitIndex = -1;

  for (let i = 0; i < alliesPos.length && hitIndex === -1; i++) {
    const a = alliesPos[i];
    const depthT  = clamp((a.y - top) / (bottom - top), 0, 1);
    const allyHitR = TUNE.allySize * TUNE.allyHitMul * lerp(0.45, 1.0, depthT);
    for (let zi = 0; zi < state.zombies.length; zi++) {
      const z = state.zombies[zi];
      const dx = z.x - a.x, dy = z.y - a.y;
      const rr = z.hitR + allyHitR;
      if (dx*dx + dy*dy <= rr*rr) { hitIndex = i; break; }
    }
  }

  if (hitIndex === -1 && state.boss) {
    const b = state.boss;
    for (let i = 0; i < alliesPos.length; i++) {
      const a = alliesPos[i];
      const depthT  = clamp((a.y - top) / (bottom - top), 0, 1);
      const allyHitR = TUNE.allySize * TUNE.allyHitMul * lerp(0.45, 1.0, depthT);
      const dx = b.x - a.x, dy = (b.y + b.size * 0.1) - a.y;
      const rr = b.hitR + allyHitR;
      if (dx*dx + dy*dy <= rr*rr) { hitIndex = i; break; }
    }
  }

  if (hitIndex !== -1) {
    state.allies = Math.max(0, state.allies - 1);
    uiAllies.textContent = state.allies;
    uiDps.textContent = Math.round(state.allies * state.baseDmg * state.fireRate);
    showToast("접촉 사망: allies -1");

    const p = alliesPos[hitIndex];
    for (let k = 0; k < 18; k++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(40, 220);
      state.particles.push({ x: p.x, y: p.y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, r: rand(1.2,3.2), t: rand(0.18,0.55) });
    }

    if (state.allies <= 0) {
      state.running = false;
      stopGunSound();
      overlay.classList.remove("hidden");
      ovTitle.textContent = "dead";
      ovDesc.textContent  = "zombie contact";
    }
  }
}
