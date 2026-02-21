/* js/render.js — all draw functions + render loop */

function drawShadow(x, y, w, h, alpha = 0.35) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// ─── Stage background ─────────────────────────────────────────────────────────
function drawStage() {
  const { w, h } = getRoadBounds();
  const img = IMG.stage;
  if (!img || !img.complete || img.naturalWidth === 0) {
    ctx.fillStyle = "#0b0f14";
    ctx.fillRect(0, 0, w, h);
    return;
  }

  const iw = img.naturalWidth, ih = img.naturalHeight;
  const scale = Math.max(w / iw, h / ih);
  const dw = iw * scale, dh = ih * scale;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);

  ctx.fillStyle = "rgba(0,0,0,.25)";
  ctx.fillRect(0, 0, w, h);

  // sky mask (좀비가 도시 저 멀리서 오는 것처럼)
  const { top } = getRoadBounds();
  const skyGrad = ctx.createLinearGradient(0, 0, 0, top + 40);
  skyGrad.addColorStop(0,   "rgba(0,0,0,0.92)");
  skyGrad.addColorStop(0.7, "rgba(0,0,0,0.75)");
  skyGrad.addColorStop(1,   "rgba(0,0,0,0)");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, w, top + 40);
}

// ─── Road overlay ─────────────────────────────────────────────────────────────
function drawRoadFrame() {
  const { w, h, left, right } = getRoadBounds();

  ctx.fillStyle = "rgba(0,0,0,.35)";
  ctx.fillRect(0, 0, left, h);
  ctx.fillRect(right, 0, w - right, h);

  ctx.strokeStyle = "rgba(255,255,255,.07)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left, 0); ctx.lineTo(left, h);
  ctx.moveTo(right, 0); ctx.lineTo(right, h);
  ctx.stroke();

  ctx.strokeStyle = "rgba(255,255,255,.06)";
  ctx.setLineDash([10, 10]);
  ctx.beginPath();
  ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h);
  ctx.stroke();
  ctx.setLineDash([]);

  const vg = ctx.createRadialGradient(w / 2, h * 0.6, 40, w / 2, h * 0.6, Math.max(w, h));
  vg.addColorStop(0, "rgba(0,0,0,0)");
  vg.addColorStop(1, "rgba(0,0,0,.35)");
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, w, h);
}

// ─── Zombies ──────────────────────────────────────────────────────────────────
function drawZombies() {
  for (let i = 0; i < state.zombies.length; i++) {
    const z   = state.zombies[i];
    const img = z.type === 1 ? IMG.zombie1 : IMG.zombie2;

    const spN = clamp((z.spd - 35) / 85, 0, 1);
    const shW = z.size * (0.26 + spN * 0.20);
    const shH = z.size * (0.12 - spN * 0.03);
    drawShadow(z.x, z.y + z.size * 0.22, shW, Math.max(2, shH), 0.32);

    const freq = 7.0 + spN * 5.0;
    const amp  = (0.05 + spN * 0.06) * (0.7 + 0.6 * z.scale);
    const rot  = Math.sin(state.time * freq + z.swaySeed) * amp;
    drawImageAnchoredRot(img, z.x, z.y, z.size, z.size, 0.5, 0.62, rot, 1);

    const hpT = clamp(z.hp / z.maxHp, 0, 1);
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillRect(z.x - 14, z.y - z.size * 0.45, 28, 4);
    ctx.fillStyle = "rgba(66,245,161,.85)";
    ctx.fillRect(z.x - 14, z.y - z.size * 0.45, 28 * hpT, 4);
  }
}

// ─── Boss ─────────────────────────────────────────────────────────────────────
function drawBoss() {
  if (!state.boss) return;
  const b = state.boss;

  drawShadow(b.x, b.y + b.size * 0.42, b.size * 0.34, b.size * 0.16, 0.38);

  const walkSway = Math.sin(b.walkT * 2.5) * 0.06;
  drawImageAnchoredRot(IMG.boss, b.x, b.y, b.size, b.size, 0.5, 0.52, walkSway, 1);

  if (b.size > 30) {
    const hpT  = clamp(b.hp / b.maxHp, 0, 1);
    const barW = Math.max(50, b.size * 1.1);
    const barH = Math.max(3, b.size * 0.04);
    const x = b.x - barW / 2;
    const y = b.y - b.size * 0.58;

    ctx.fillStyle = "rgba(0,0,0,.45)";   ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = "rgba(255,93,93,.85)"; ctx.fillRect(x, y, barW * hpT, barH);
    ctx.strokeStyle = "rgba(255,255,255,.18)"; ctx.strokeRect(x, y, barW, barH);

    if (b.size > 60) {
      ctx.fillStyle = "rgba(232,238,248,.85)";
      ctx.font = `${Math.max(9, Math.floor(b.size * 0.055))}px system-ui, sans-serif`;
      ctx.fillText(`boss ${Math.max(0, Math.floor(b.hp))}`, x, y - 4);
    }
  }
}

// ─── Allies (원근 적용) ────────────────────────────────────────────────────────
function drawAllies() {
  const alliesPos = getAllyPositions();
  const { w, top, bottom } = getRoadBounds();

  for (let i = 0; i < alliesPos.length; i++) {
    const p = alliesPos[i];

    // 원근 스케일: 위(멀리) → 작게, 아래(가까이) → 크게
    const depthT = clamp((p.y - top) / (bottom - top), 0, 1);
    const ps = lerp(0.45, 1.0, depthT);

    const sz = ((i === 0) ? TUNE.heroSize : TUNE.allySize) * ps;

    // ground glow ring
    ctx.strokeStyle = "rgba(66,245,161,.22)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y + 10 * ps, 16 * ps, 0, Math.PI * 2);
    ctx.stroke();

    drawShadow(p.x, p.y + 18 * ps, 14 * ps, 6 * ps, 0.25);
    drawImageAnchored(IMG.hero, p.x, p.y, sz, sz, 0.5, 0.58, 1);
  }

  // leader marker
  const lx = w / 2 + state.leaderX;
  const ly = state.leaderY;
  ctx.strokeStyle = "rgba(255,255,255,.14)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(lx, ly + 10, 22, 0, Math.PI * 2);
  ctx.stroke();
}

// ─── Muzzle flashes ───────────────────────────────────────────────────────────
function drawMuzzleFlashes() {
  for (let i = 0; i < state.muzzleFlashes.length; i++) {
    const f    = state.muzzleFlashes[i];
    const frac = f.t / 0.09;
    ctx.save();
    ctx.globalAlpha = frac;
    ctx.translate(f.x, f.y);
    ctx.rotate(f.ang);

    const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, 11);
    grd.addColorStop(0,   "rgba(255,255,200,1)");
    grd.addColorStop(0.4, "rgba(255,140,30,0.85)");
    grd.addColorStop(1,   "rgba(255,60,0,0)");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(0, 0, 9 * frac + 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "rgba(255,220,80,0.95)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(2, 0); ctx.lineTo(20 * frac, 0);
    ctx.stroke();

    ctx.strokeStyle = "rgba(255,170,40,0.65)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(2, 0); ctx.lineTo(11 * frac, -5 * frac);
    ctx.moveTo(2, 0); ctx.lineTo(11 * frac,  5 * frac);
    ctx.stroke();

    ctx.restore();
  }
}

// ─── Bullets ──────────────────────────────────────────────────────────────────
function drawBullets() {
  ctx.fillStyle = "rgba(255,255,255,.95)";
  for (let i = 0; i < state.bullets.length; i++) {
    const b = state.bullets[i];
    ctx.strokeStyle = "rgba(255,255,255,.22)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Particles & smoke ────────────────────────────────────────────────────────
function drawParticles() {
  for (let i = 0; i < state.particles.length; i++) {
    const p = state.particles[i];
    ctx.fillStyle = "rgba(255,204,102,.7)";
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSmokes() {
  for (let i = 0; i < state.smokes.length; i++) {
    const s = state.smokes[i];
    const t = clamp(s.t, 0, 2.5);
    const a = s.a * (t / 2.0);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = "#9aa3ad";
    ctx.shadowBlur = 18;
    ctx.shadowColor = "rgba(0,0,0,.35)";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// ─── Gate / card ──────────────────────────────────────────────────────────────
function drawGate(g) {
  if (!g.leftDead)  drawGateCard(g.leftX,  g.leftY,  g.effW, g.effH, g.leftOpt,  g.leftHp,  g.leftMaxHp);
  if (!g.rightDead) drawGateCard(g.rightX, g.rightY, g.effW, g.effH, g.rightOpt, g.rightHp, g.rightMaxHp);
}

function drawGateCard(x, y, w, h, opt, hp, maxHp) {
  const iconKey = opt.icon;
  const iconImg = iconKey ? IMG[iconKey] : null;

  if (iconImg && iconImg.complete && iconImg.naturalWidth > 0) {
    drawImageAnchored(iconImg, x + w / 2, y + h / 2, w, h, 0.5, 0.5, 1.0);
  } else {
    const grad = ctx.createLinearGradient(x, y, x + w, y);
    grad.addColorStop(0, "rgba(255,153,102,.65)");
    grad.addColorStop(1, "rgba(66,245,161,.55)");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(255,255,255,.55)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, w, h);
    if (h > 14) {
      ctx.fillStyle = "rgba(232,238,248,.95)";
      ctx.font = `bold ${Math.max(8, Math.floor(h * 0.45))}px system-ui`;
      ctx.fillText(opt.label, x + 2, y + h * 0.65);
    }
  }

  const barH    = Math.max(2, h * 0.14);
  const hpRatio = Math.max(0, hp / maxHp);
  ctx.fillStyle = "rgba(0,0,0,.55)";
  ctx.fillRect(x, y + h + 1, w, barH);
  ctx.fillStyle = hpRatio > 0.5 ? "#42f5a1" : hpRatio > 0.25 ? "#ffcc66" : "#ff5d5d";
  ctx.fillRect(x, y + h + 1, w * hpRatio, barH);
}

// ─── Airstrike FX ─────────────────────────────────────────────────────────────
function drawAirstrikeFx() {
  if (!state.airAnim) return;
  const { h } = getRoadBounds();
  const a = state.airAnim;

  const alpha = a.phase === "warn" ? (0.25 + 0.15 * Math.sin(state.time * 18)) : 0.12;
  ctx.save();
  ctx.fillStyle = `rgba(255,75,75,${alpha})`;
  ctx.fillRect(a.cx - a.half, 0, a.half * 2, h);
  ctx.strokeStyle = `rgba(255,150,150,${0.45 + 0.25 * Math.sin(state.time * 10)})`;
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 10]);
  ctx.strokeRect(a.cx - a.half, 10, a.half * 2, h - 20);
  ctx.setLineDash([]);

  ctx.strokeStyle = "rgba(255,210,210,.55)";
  ctx.beginPath();
  ctx.moveTo(a.cx - 18, h * 0.18); ctx.lineTo(a.cx + 18, h * 0.18);
  ctx.moveTo(a.cx, h * 0.18 - 18); ctx.lineTo(a.cx, h * 0.18 + 18);
  ctx.stroke();

  if (a.phase === "bombs" || a.phase === "strike") {
    for (let i = 0; i < a.bombs.length; i++) {
      const b = a.bombs[i];
      ctx.strokeStyle = "rgba(255,220,180,.45)";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y - 40); ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,240,220,.85)";
      ctx.beginPath();
      ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

// ─── Pickups ──────────────────────────────────────────────────────────────────
function drawPickups() {
  for (let i = 0; i < state.pickups.length; i++) {
    const p        = state.pickups[i];
    const bob      = Math.sin(state.time * 4 + p.bob) * 4;
    const isFreeze = p.type === "freeze";

    drawShadow(p.x, p.y + 18 + bob, 14, 5, 0.18);

    ctx.save();
    ctx.translate(p.x, p.y + bob);
    ctx.globalAlpha = 0.92;

    ctx.fillStyle = isFreeze ? "rgba(10,20,40,.80)" : "rgba(20,25,35,.75)";
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();

    if (isFreeze) {
      ctx.strokeStyle = "rgba(100,210,255,.95)";
      ctx.lineWidth = 2;
      for (let ai = 0; ai < 6; ai++) {
        const ang = (ai * Math.PI) / 3;
        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(Math.cos(ang) * 11, Math.sin(ang) * 11);
        ctx.stroke();
        const bx = Math.cos(ang) * 7, by = Math.sin(ang) * 7;
        ctx.beginPath();
        ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(ang+0.8)*4, by + Math.sin(ang+0.8)*4);
        ctx.moveTo(bx, by); ctx.lineTo(bx + Math.cos(ang-0.8)*4, by + Math.sin(ang-0.8)*4);
        ctx.stroke();
      }
      ctx.fillStyle = "rgba(180,240,255,.95)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("ICE", 0, 26);
      ctx.textAlign = "left";
    } else {
      ctx.strokeStyle = "rgba(255,120,120,.95)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-10, 0); ctx.lineTo(10, 0);
      ctx.moveTo(0, -10); ctx.lineTo(0, 10);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,220,200,.95)";
      ctx.font = "10px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("AIR", 0, 26);
      ctx.textAlign = "left";
    }
    ctx.restore();
  }
}

// ─── Main render ──────────────────────────────────────────────────────────────
function render() {
  const { w, h, left } = getRoadBounds();

  let sx = 0, sy = 0;
  if (state.shakeT > 0 && state.shakeTMax > 0) {
    const t   = state.shakeT / state.shakeTMax;
    const mag = state.shakeMag * t;
    sx = rand(-mag, mag);
    sy = rand(-mag, mag);
  }

  ctx.save();
  ctx.translate(sx, sy);

  drawStage();
  drawRoadFrame();
  drawSmokes();
  drawPickups();
  if (state.gate) drawGate(state.gate);
  drawZombies();
  drawBoss();
  drawBullets();
  drawMuzzleFlashes();
  drawAllies();
  drawParticles();
  drawAirstrikeFx();

  ctx.restore();

  // screen flash
  if (state.flashT > 0) {
    const a = clamp(state.flashT / 0.18, 0, 1);
    ctx.save();
    ctx.globalAlpha = 0.35 * a;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  // 프리즈 카운터 애니메이션 (가운데)
  if (state.freezeT > 0) {
    const sec      = Math.ceil(state.freezeT);
    const pulse    = 1 + 0.12 * Math.sin(state.time * 10);
    const fontSize = Math.round(88 * pulse);
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
    ctx.shadowColor = "#88eeff"; ctx.shadowBlur = 32;
    ctx.fillStyle = "rgba(180,240,255,0.18)";
    ctx.fillText(sec, w / 2, h / 2 + 30);
    ctx.shadowBlur = 14;
    ctx.fillStyle = "#cff6ff";
    ctx.fillText(sec, w / 2, h / 2 + 30);
    ctx.font = "bold 18px system-ui, sans-serif";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "rgba(140,220,255,0.9)";
    ctx.fillText("❄ FREEZE", w / 2, h / 2 - 40);
    ctx.shadowBlur = 0;
    ctx.textAlign = "left";
    ctx.restore();

    ctx.save();
    ctx.globalAlpha = 0.08 + 0.04 * Math.sin(state.time * 6);
    ctx.fillStyle = "#88ddff";
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  drawItemSlots(w, h);

  // debug
  ctx.fillStyle = "rgba(159,176,199,.65)";
  ctx.font = "12px system-ui, sans-serif";
  ctx.fillText(`zombies: ${state.zombies.length}`, left + 10, 18);
}

// ─── Item slot HUD (캔버스 좌하단) ────────────────────────────────────────────
function drawItemSlots(w, h) {
  const slots = [
    { count: state.airCharges,    label: "AIR", color: "rgba(255,120,100,", icon: "🎯" },
    { count: state.freezeCharges, label: "ICE", color: "rgba(100,200,255,",  icon: "❄" },
  ];

  const slotW = 52, slotH = 44, gap = 8, pad = 12;
  const totalW = slots.length * slotW + (slots.length - 1) * gap;
  let bx = w / 2 - totalW / 2;
  const by = h - slotH - pad;

  for (let i = 0; i < slots.length; i++) {
    const s  = slots[i];
    const x  = bx + i * (slotW + gap);
    const hasItem = s.count > 0;

    // 배경
    ctx.save();
    ctx.globalAlpha = hasItem ? 0.82 : 0.38;
    ctx.fillStyle = `${s.color}0.18)`;
    ctx.strokeStyle = `${s.color}${hasItem ? "0.7" : "0.25"})`;
    ctx.lineWidth = hasItem ? 2 : 1;
    ctx.fillRect(x, by, slotW, slotH);
    ctx.strokeRect(x, by, slotW, slotH);

    // 아이콘 & 개수
    ctx.textAlign = "center";
    ctx.fillStyle = hasItem ? "#ffffff" : "rgba(255,255,255,0.35)";
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillText(s.icon, x + slotW / 2, by + 20);

    ctx.font = `bold 13px system-ui, sans-serif`;
    ctx.fillStyle = hasItem ? `${s.color}1)` : "rgba(255,255,255,0.3)";
    ctx.fillText(`×${s.count}`, x + slotW / 2, by + 36);

    ctx.restore();
  }
}
