/* /game.js */
(() => {
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d", { alpha: false });

  const uiStage = document.getElementById("uiStage");
  const uiAllies = document.getElementById("uiAllies");
  const uiDps = document.getElementById("uiDps");

  const btnPause = document.getElementById("btnPause");
  const btnRestart = document.getElementById("btnRestart");

  const overlay = document.getElementById("overlay");
  const btnStart = document.getElementById("btnStart");
  const ovTitle = document.getElementById("ovTitle");
  const ovDesc = document.getElementById("ovDesc");

  const toast = document.getElementById("toast");

  const DPR = Math.min(2, window.devicePixelRatio || 1);

  function fit() {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * DPR);
    canvas.height = Math.floor(rect.height * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener("resize", fit);

  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toast.classList.remove("show"), 900);
  }

  const state = {
    running: false,
    paused: false,
    time: 0,
    stage: 1,
    wave: 0,

    roadW: 420,

    // 리더(편대 중심) 위치: 화면 중심 기준 offset
    leaderX: 0,
    leaderY: 0,

    targetX: 0,
    targetY: 0,

    // 이동 속도
    moveSpeed: 420, // keyboard 기준 px/s

    allies: 1,
    baseDmg: 10,
    fireRate: 6,      // shots per second per ally
    bulletSpeed: 720,
    spread: 0.06,     // radians

    bullets: [],
    zombies: [],
    particles: [],

    gate: null,
    gateCooldown: 0,

    boss: null,
    bossEveryWaves: 5,
  };

  function reset() {
    state.running = false;
    state.paused = false;
    state.time = 0;
    state.stage = 1;
    state.wave = 0;

    state.leaderX = 0;
    state.leaderY = 0;

    state.targetX = 0;
    state.targetY = 0;

    state.moveSpeed = 420;

    state.allies = 1;
    state.baseDmg = 10;
    state.fireRate = 6;
    state.bulletSpeed = 720;
    state.spread = 0.06;

    state.bullets.length = 0;
    state.zombies.length = 0;
    state.particles.length = 0;

    state.gate = null;
    state.gateCooldown = 0;

    state.boss = null;

    uiStage.textContent = state.stage;
    uiAllies.textContent = state.allies;
    uiDps.textContent = Math.round(state.allies * state.baseDmg * state.fireRate);
  }

  function getRoadBounds() {
    const w = canvas.getBoundingClientRect().width;
    const h = canvas.getBoundingClientRect().height;

    const roadW = Math.min(state.roadW, w - 24);
    const left = (w - roadW) / 2;
    const right = left + roadW;

    // 리더가 상하로 움직일 수 있는 범위 (너무 위로 올라가면 재미/난이도 깨짐 방지)
    const top = h * 0.45;
    const bottom = h * 0.88;

    return { w, h, roadW, left, right, top, bottom };
  }

function spawnWave() {
  state.wave += 1;

  const { left, right } = getRoadBounds();

  // 🔹 스테이지1 기준 25~40 범위
  // 이후 스테이지마다 점진 증가
  const baseMin = 25;
  const baseMax = 40;

  const stageGrowth = (state.stage - 1) * 12;
  const waveGrowth = (state.wave - 1) * 4;

  const minCount = baseMin + stageGrowth + waveGrowth;
  const maxCount = baseMax + stageGrowth + waveGrowth;

  const count = Math.floor(rand(minCount, maxCount));

  // 체력
  const hpBase = 18;
  const hpGrowth = 6;
  const hp = hpBase + (state.stage - 1) * hpGrowth;

  // 🔹 속도 15% 감소 (기존 46~86 → 0.85배)
  const speedMul = 0.85;

  for (let i = 0; i < count; i++) {
    const x = rand(left + 12, right - 12);
    const y = rand(-520, -20);

    const baseSpeed = rand(46, 86) + state.stage * 3;
    const spd = baseSpeed * speedMul;

    state.zombies.push({
      x,
      y,
      r: rand(6.5, 9.5),
      hp: hp + rand(-3, 6),
      maxHp: hp,
      spd
    });
  }

  if (state.wave % state.bossEveryWaves === 0) {
    spawnBoss();
  }
}

  function spawnBoss() {
    const { left, right } = getRoadBounds();
    const maxHp = 2200 + (state.stage - 1) * 900;

    state.boss = {
      x: (left + right) / 2,
      y: -180,
      w: 120,
      h: 120,
      hp: maxHp,
      maxHp,
      spd: 22 + state.stage * 2,
      stompT: 0,
    };

    showToast("boss 등장");
  }

  function makeGateOptions() {
    const opts = [
      { key: "add2", label: "+2 allies", apply() { state.allies += 2; } },
      { key: "add5", label: "+5 allies", apply() { state.allies += 5; } },
      { key: "rate", label: "fire rate +20%", apply() { state.fireRate *= 1.2; } },
      { key: "dmg", label: "damage +25%", apply() { state.baseDmg *= 1.25; } },
      { key: "speed", label: "bullet speed +15%", apply() { state.bulletSpeed *= 1.15; } },
      { key: "spread", label: "spread -15%", apply() { state.spread *= 0.85; } },
      { key: "turret", label: "turret burst", apply() { burstTurret(); } },
      { key: "nuke", label: "air strike", apply() { airStrike(); } },
    ];

    function pickWeighted() {
      const roll = Math.random();
      if (roll < 0.55) return opts[Math.floor(Math.random() * 4)];
      if (roll < 0.88) return opts[4 + Math.floor(Math.random() * 2)];
      return opts[6 + Math.floor(Math.random() * 2)];
    }

    let a = pickWeighted();
    let b = pickWeighted();
    while (b.key === a.key) b = pickWeighted();
    return [a, b];
  }

  function spawnGate() {
    const { w, left, right } = getRoadBounds();

    const y = -40;
    const mid = (left + right) / 2;
    const gap = 110;

    const [optL, optR] = makeGateOptions();

    state.gate = {
      y,
      h: 64,
      leftRect: { x: mid - gap - 120, w: 220, opt: optL },
      rightRect:{ x: mid + gap - 100, w: 220, opt: optR },
      speed: 160 + state.stage * 10,
      resolved: false,
    };
  }

  function applyGate(which) {
    if (!state.gate || state.gate.resolved) return;
    const opt = which === "L" ? state.gate.leftRect.opt : state.gate.rightRect.opt;
    opt.apply();
    state.gate.resolved = true;
    showToast(`선택: ${opt.label}`);
    uiAllies.textContent = state.allies;
    uiDps.textContent = Math.round(state.allies * state.baseDmg * state.fireRate);
  }

  function burstTurret() {
    const { w, h } = getRoadBounds();
    const px = w / 2 + state.leaderX;
    const py = state.leaderY;

    const bursts = 14;
    for (let i = 0; i < bursts; i++) {
      const ang = -Math.PI / 2 + rand(-0.55, 0.55);
      const spd = 860 + rand(-80, 80);
      state.bullets.push({
        x: px,
        y: py - 10,
        vx: Math.cos(ang) * spd,
        vy: Math.sin(ang) * spd,
        dmg: state.baseDmg * 1.2,
        r: 2.2,
        ttl: 1.2,
        pierce: 2
      });
    }
  }

  function airStrike() {
    const { left, right } = getRoadBounds();

    const hits = 6;
    for (let i = 0; i < hits; i++) {
      const x = rand(left + 30, right - 30);
      const y = rand(80, 260);
      explode(x, y, 70, state.baseDmg * 18);
    }
  }

  function explode(x, y, radius, dmg) {
    for (let i = state.zombies.length - 1; i >= 0; i--) {
      const z = state.zombies[i];
      const dx = z.x - x;
      const dy = z.y - y;
      const d = Math.hypot(dx, dy);
      if (d <= radius + z.r) {
        z.hp -= dmg * (1 - d / (radius + z.r));
        if (z.hp <= 0) {
          killZombie(i, z, 10);
        }
      }
    }

    if (state.boss) {
      const b = state.boss;
      const cx = b.x;
      const cy = b.y + b.h * 0.6;
      const d = Math.hypot(cx - x, cy - y);
      if (d < radius + 60) {
        b.hp -= dmg * 0.55;
        if (b.hp <= 0) {
          state.boss = null;
          showToast("boss 처치");
        }
      }
    }

    const pCount = 26;
    for (let i = 0; i < pCount; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(60, 260);
      state.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        r: rand(1.5, 3.5),
        t: rand(0.25, 0.7),
      });
    }
  }

  function killZombie(idx, z, pcount = 6) {
    state.zombies.splice(idx, 1);
    for (let j = 0; j < pcount; j++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(30, 160);
      state.particles.push({
        x: z.x,
        y: z.y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        r: rand(1, 2.8),
        t: rand(0.2, 0.55),
      });
    }
  }

  // 편대(ally) 좌표 계산
  function getAllyPositions() {
    const { w, roadW, top, bottom } = getRoadBounds();

    // 리더 좌표를 안전 범위로 강제
    const maxX = roadW * 0.42;
    const leaderX = clamp(state.leaderX, -maxX, maxX);
    const leaderY = clamp(state.leaderY, top, bottom);

    // formation: 1열~3열 느낌 (단순)
    // 1명: 중앙
    // 2~5명: 1열
    // 6~12명: 2열 추가
    const spacingX = 18;
    const spacingY = 18;

    const res = [];
    const count = state.allies;

    // 맨 앞(중앙)부터 채우되, 좌우/뒤로 퍼짐
    // rowCapacity: 1열 7명, 2열 9명, 3열 11명...
    let remain = count;
    let row = 0;
    while (remain > 0 && row < 6) {
      const cap = 5 + row * 2; // 5,7,9,11...
      const take = Math.min(remain, cap);

      for (let i = 0; i < take; i++) {
        const offset = (i - (take - 1) / 2) * spacingX;
        const x = leaderX + offset;
        const y = leaderY + row * spacingY;
        res.push({ x: w / 2 + x, y });
      }

      remain -= take;
      row += 1;
    }

    return res;
  }

  // 입력
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
  window.addEventListener("mouseup", onUp);

  canvas.addEventListener("touchstart", (e) => { e.preventDefault(); onDown(e); }, { passive: false });
  canvas.addEventListener("touchmove", (e) => { e.preventDefault(); onMove(e); }, { passive: false });
  canvas.addEventListener("touchend", (e) => { e.preventDefault(); onUp(e); }, { passive: false });

  // 키보드
  const keys = new Set();
  window.addEventListener("keydown", (e) => keys.add(e.key));
  window.addEventListener("keyup", (e) => keys.delete(e.key));

  // UI
  btnPause.addEventListener("click", () => {
    if (!state.running) return;
    state.paused = !state.paused;
    btnPause.textContent = state.paused ? "resume" : "pause";
    showToast(state.paused ? "일시정지" : "재개");
  });

  btnRestart.addEventListener("click", () => {
    reset();
    overlay.classList.remove("hidden");
    ovTitle.textContent = "ready";
    ovDesc.textContent = "click / tap to start";
    btnPause.textContent = "pause";
  });

  btnStart.addEventListener("click", startGame);

  function startGame() {
    overlay.classList.add("hidden");
    state.running = true;
    state.paused = false;
    btnPause.textContent = "pause";
    showToast("start");

    const { h, top, bottom } = getRoadBounds();
    // 시작 위치: 하단 근처
    state.leaderY = lerp(top, bottom, 0.9);
    state.targetY = state.leaderY;

    spawnWave();
  }

  // 게임 루프
  let last = performance.now();

  function tick(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;

    fitIfNeeded();
    update(dt);
    render();

    requestAnimationFrame(tick);
  }

  function fitIfNeeded() {
    if (!fitIfNeeded._inited) {
      fit();
      fitIfNeeded._inited = true;
    }
  }

  let shootAcc = 0;

  function autoShoot(dt) {
    shootAcc += dt;
    const interval = 1 / state.fireRate;

    // 타겟: 가장 아래쪽(가까운) 좀비 우선
    let tx = null;
    let ty = null;

    let best = null;
    let bestY = -1e9;
    for (let i = 0; i < state.zombies.length; i++) {
      const z = state.zombies[i];
      if (z.y > bestY) { bestY = z.y; best = z; }
    }

    if (state.boss) {
      tx = state.boss.x;
      ty = state.boss.y + state.boss.h * 0.6;
    } else if (best) {
      tx = best.x;
      ty = best.y;
    }

    if (tx == null) return;

    const alliesPos = getAllyPositions();

    while (shootAcc >= interval) {
      shootAcc -= interval;

      for (let i = 0; i < alliesPos.length; i++) {
        const p = alliesPos[i];

        const ang = Math.atan2(ty - p.y, tx - p.x) + rand(-state.spread, state.spread);
        const spd = state.bulletSpeed;

        state.bullets.push({
          x: p.x,
          y: p.y - 8,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          dmg: state.baseDmg,
          r: 2.0,
          ttl: 1.25,
          pierce: 1
        });
      }
    }
  }

  function bulletCollisions() {
    const { h } = getRoadBounds();

    for (let bi = state.bullets.length - 1; bi >= 0; bi--) {
      const b = state.bullets[bi];
      let hit = false;

      for (let zi = state.zombies.length - 1; zi >= 0; zi--) {
        const z = state.zombies[zi];
        const dx = z.x - b.x;
        const dy = z.y - b.y;
        const rr = z.r + b.r;

        if (dx * dx + dy * dy <= rr * rr) {
          z.hp -= b.dmg;
          hit = true;

          state.particles.push({
            x: b.x,
            y: b.y,
            vx: rand(-40, 40),
            vy: rand(-40, 40),
            r: rand(1, 2.5),
            t: rand(0.08, 0.18),
          });

          if (z.hp <= 0) {
            killZombie(zi, z, 7);
          }

          b.pierce -= 1;
          if (b.pierce <= 0) break;
        }
      }

      if (state.boss && b.pierce > 0) {
        const boss = state.boss;
        const bx = boss.x;
        const by = boss.y + boss.h * 0.6;
        const dx = bx - b.x;
        const dy = by - b.y;
        const rr = 68 + b.r;

        if (dx * dx + dy * dy <= rr * rr) {
          boss.hp -= b.dmg;
          hit = true;

          state.particles.push({
            x: b.x,
            y: b.y,
            vx: rand(-50, 50),
            vy: rand(-50, 50),
            r: rand(1, 3),
            t: rand(0.08, 0.2),
          });

          b.pierce = 0;

          if (boss.hp <= 0) {
            state.boss = null;
            showToast("boss 처치");
          }
        }
      }

      if (b.y > h + 60) b.pierce = 0;

      if (hit && b.pierce <= 0) {
        state.bullets.splice(bi, 1);
      }
    }
  }

  // 좀비 접촉 사망 처리
  function contactDeaths() {
    const alliesPos = getAllyPositions();
    if (alliesPos.length === 0) return;

    // 접촉한 유닛 1명만 죽이기: 가장 먼저 충돌한 1건만 처리
    // (원하면 "여러명 동시 접촉이면 여러명 사망"으로 바꿀 수 있음)
    let hitIndex = -1;

    for (let i = 0; i < alliesPos.length; i++) {
      const a = alliesPos[i];
      const ar = 10; // ally 충돌 반경

      for (let zi = 0; zi < state.zombies.length; zi++) {
        const z = state.zombies[zi];
        const dx = z.x - a.x;
        const dy = z.y - a.y;
        const rr = z.r + ar;

        if (dx * dx + dy * dy <= rr * rr) {
          hitIndex = i;
          break;
        }
      }
      if (hitIndex !== -1) break;
    }

    if (hitIndex !== -1) {
      // 접촉한 유닛 1명 감소
      state.allies = Math.max(0, state.allies - 1);
      uiAllies.textContent = state.allies;
      uiDps.textContent = Math.round(state.allies * state.baseDmg * state.fireRate);

      showToast("접촉 사망: allies -1");

      // 피격 파티클
      const p = alliesPos[hitIndex];
      for (let k = 0; k < 18; k++) {
        const a = rand(0, Math.PI * 2);
        const s = rand(40, 220);
        state.particles.push({
          x: p.x, y: p.y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          r: rand(1.2, 3.2),
          t: rand(0.18, 0.55),
        });
      }

      // 0명이면 게임오버
      if (state.allies <= 0) {
        state.running = false;
        overlay.classList.remove("hidden");
        ovTitle.textContent = "dead";
        ovDesc.textContent = "zombie contact";
      }
    }
  }

  function update(dt) {
    const { w, h, roadW, top, bottom } = getRoadBounds();
    if (!state.running || state.paused) return;

    state.time += dt;

    // 이동: 터치/마우스는 목표로 따라가고, 키보드는 직접 가속
    const maxX = roadW * 0.42;

    // 키보드 입력
    let kx = 0, ky = 0;
    if (keys.has("ArrowLeft") || keys.has("a")) kx -= 1;
    if (keys.has("ArrowRight") || keys.has("d")) kx += 1;
    if (keys.has("ArrowUp") || keys.has("w")) ky -= 1;
    if (keys.has("ArrowDown") || keys.has("s")) ky += 1;

    const usingKeyboard = (kx !== 0 || ky !== 0);

    if (usingKeyboard) {
      // 대각선 정규화
      const len = Math.hypot(kx, ky) || 1;
      kx /= len; ky /= len;

      state.leaderX += kx * state.moveSpeed * dt;
      state.leaderY += ky * state.moveSpeed * dt;

      state.targetX = state.leaderX;
      state.targetY = state.leaderY;
    } else {
      // 포인터 목표로 따라감
      state.leaderX = lerp(state.leaderX, state.targetX, 0.18);
      // y는 조금 더 빠르게 따라오게
      state.leaderY = lerp(state.leaderY, state.targetY, 0.20);
    }

    state.leaderX = clamp(state.leaderX, -maxX, maxX);
    state.leaderY = clamp(state.leaderY, top, bottom);

    // 사격
    autoShoot(dt);

    // 총알 이동
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.ttl -= dt;

      if (b.ttl <= 0 || b.y < -80 || b.y > h + 80 || b.x < -80 || b.x > w + 80) {
        state.bullets.splice(i, 1);
      }
    }

    // 좀비 이동: 위→아래만
    for (let i = state.zombies.length - 1; i >= 0; i--) {
      const z = state.zombies[i];
      z.y += z.spd * dt;

      // 화면 아래로 지나가면 제거 (패널티는 원하면 넣기)
      if (z.y > h + 90) {
        state.zombies.splice(i, 1);
      }
    }

    // 보스 이동/패턴
    if (state.boss) {
      const b = state.boss;
      b.y += b.spd * dt;
      b.stompT += dt;

      if (b.stompT > 2.8) {
        b.stompT = 0;
        explode(b.x, b.y + b.h * 0.8, 90, state.baseDmg * 6);
      }

      if (b.y > 170) b.spd = 36 + state.stage * 3;

      if (b.y > h * 0.90) {
        state.running = false;
        overlay.classList.remove("hidden");
        ovTitle.textContent = "overrun";
        ovDesc.textContent = "restart to try again";
      }
    }

    // 충돌: 총알 vs 적
    bulletCollisions();

    // 충돌: 좀비 vs 아군(접촉 사망)
    contactDeaths();

    // 게이트 스폰/이동/판정
    state.gateCooldown -= dt;
    if (!state.gate && state.gateCooldown <= 0 && state.time > 2.0) {
      if (state.zombies.length < 140 && (!state.boss || state.boss.hp < state.boss.maxHp * 0.85)) {
        spawnGate();
      }
    }

    if (state.gate) {
      state.gate.y += state.gate.speed * dt;

      // 리더(편대 중심)가 게이트에 닿으면 선택
      const gy = state.gate.y;
      const gh = state.gate.h;

      if (!state.gate.resolved && gy < state.leaderY && gy + gh > state.leaderY - 8) {
        const worldPX = w / 2 + state.leaderX;
        const L = state.gate.leftRect;
        const R = state.gate.rightRect;
        const gateTop = gy;
        const gateBot = gy + gh;

        if (state.leaderY >= gateTop && state.leaderY <= gateBot) {
          const hitL = (worldPX >= L.x && worldPX <= L.x + L.w);
          const hitR = (worldPX >= R.x && worldPX <= R.x + R.w);

          if (hitL) applyGate("L");
          else if (hitR) applyGate("R");
        }
      }

      if (state.gate.y > h + 80) {
        state.gate = null;
        state.gateCooldown = 2.2;
      }

      if (state.gate && state.gate.resolved && state.gate.y > state.leaderY + 20) {
        state.gate = null;
        state.gateCooldown = 3.0;
      }
    }

    // 파티클
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.001, dt);
      p.vy *= Math.pow(0.001, dt);
      p.t -= dt;
      if (p.t <= 0) state.particles.splice(i, 1);
    }

    // 웨이브 종료 → 다음 스테이지
    if (state.zombies.length === 0 && !state.gate && !state.boss) {
      state.stage += 1;
      uiStage.textContent = state.stage;
      showToast(`stage ${state.stage}`);
      spawnWave();

      if (state.stage % 2 === 0) state.allies += 1;
      uiAllies.textContent = state.allies;
      uiDps.textContent = Math.round(state.allies * state.baseDmg * state.fireRate);
    }
  }

  function render() {
    const { w, h, roadW, left, right, top, bottom } = getRoadBounds();
    
    // 배경
    ctx.fillStyle = "#0b0f14";
    ctx.fillRect(0, 0, w, h);

    // 도로
    ctx.fillStyle = "#0f1724";
    ctx.fillRect(left, 0, roadW, h);

    // 라인
    ctx.strokeStyle = "rgba(255,255,255,.06)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left, 0);
    ctx.lineTo(left, h);
    ctx.moveTo(right, 0);
    ctx.lineTo(right, h);
    ctx.stroke();

    // 중앙 점선
    ctx.strokeStyle = "rgba(255,255,255,.07)";
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();
    ctx.setLineDash([]);

    // 이동 가능 영역 가이드(옅게)
    ctx.strokeStyle = "rgba(255,255,255,.04)";
    ctx.lineWidth = 1;
    ctx.strokeRect(left + 6, top, roadW - 12, bottom - top);

    // 게이트
    if (state.gate) drawGate(state.gate);

    // 좀비
    for (let i = 0; i < state.zombies.length; i++) {
      const z = state.zombies[i];
      const hpT = clamp(z.hp / z.maxHp, 0, 1);

      ctx.fillStyle = "rgba(200,200,200,0.86)";
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.r, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(0,0,0,.35)";
      ctx.fillRect(z.x - 10, z.y - z.r - 10, 20, 3);
      ctx.fillStyle = "rgba(66,245,161,.85)";
      ctx.fillRect(z.x - 10, z.y - z.r - 10, 20 * hpT, 3);
    }

    // 보스
    if (state.boss) drawBoss(state.boss);

    // 총알
    ctx.fillStyle = "rgba(255,255,255,.95)";
    for (let i = 0; i < state.bullets.length; i++) {
      const b = state.bullets[i];
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 플레이어(아군)
    drawAllies();

    // 파티클
    for (let i = 0; i < state.particles.length; i++) {
      const p = state.particles[i];
      ctx.fillStyle = "rgba(255,204,102,.7)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 텍스트
    ctx.fillStyle = "rgba(159,176,199,.65)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`zombies: ${state.zombies.length}`, left + 10, 18);
  }

  function drawAllies() {
    const alliesPos = getAllyPositions();

    for (let i = 0; i < alliesPos.length; i++) {
      const p = alliesPos[i];

      // 링
      ctx.strokeStyle = "rgba(66,245,161,.35)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 12, 0, Math.PI * 2);
      ctx.stroke();

      // 본체
      ctx.fillStyle = "rgba(80,160,255,.92)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 6, 0, Math.PI * 2);
      ctx.fill();

      // 총구 라인
      ctx.strokeStyle = "rgba(255,255,255,.45)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 2);
      ctx.lineTo(p.x, p.y - 14);
      ctx.stroke();
    }

    // 리더 표시(편대 중심 위치)
    const { w } = getRoadBounds();
    const lx = w / 2 + state.leaderX;
    const ly = state.leaderY;

    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(lx, ly, 18, 0, Math.PI * 2);
    ctx.stroke();
  }

  function drawGate(g) {
    const { w } = getRoadBounds();
    const y = g.y;
    const h = g.h;

    ctx.fillStyle = "rgba(0,0,0,.20)";
    ctx.fillRect(0, y, w, h);

    drawGateRect(g.leftRect.x, y, g.leftRect.w, h, g.leftRect.opt.label, "L", g.resolved);
    drawGateRect(g.rightRect.x, y, g.rightRect.w, h, g.rightRect.opt.label, "R", g.resolved);

    ctx.strokeStyle = "rgba(255,255,255,.08)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(w / 2, y);
    ctx.lineTo(w / 2, y + h);
    ctx.stroke();
  }

  function drawGateRect(x, y, w, h, label, side, resolved) {
    const grad = ctx.createLinearGradient(x, y, x + w, y);
    grad.addColorStop(0, "rgba(255,153,102,.25)");
    grad.addColorStop(1, "rgba(66,245,161,.22)");

    ctx.fillStyle = grad;
    ctx.fillRect(x, y + 6, w, h - 12);

    ctx.strokeStyle = resolved ? "rgba(255,255,255,.10)" : "rgba(255,255,255,.22)";
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y + 6, w, h - 12);

    ctx.fillStyle = "rgba(232,238,248,.92)";
    ctx.font = "13px system-ui, sans-serif";
    ctx.fillText(label, x + 10, y + h / 2 + 5);

    ctx.fillStyle = "rgba(159,176,199,.65)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(side === "L" ? "left gate" : "right gate", x + 10, y + h - 12);
  }

  function drawBoss(b) {
    ctx.fillStyle = "rgba(220,220,220,.92)";
    ctx.fillRect(b.x - b.w / 2, b.y, b.w, b.h);

    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.fillRect(b.x - 18, b.y + 24, 10, 10);
    ctx.fillRect(b.x + 8, b.y + 24, 10, 10);

    const hpT = clamp(b.hp / b.maxHp, 0, 1);
    const barW = 240;
    const barH = 10;
    const x = b.x - barW / 2;
    const y = b.y - 18;

    ctx.fillStyle = "rgba(0,0,0,.45)";
    ctx.fillRect(x, y, barW, barH);
    ctx.fillStyle = "rgba(255,93,93,.85)";
    ctx.fillRect(x, y, barW * hpT, barH);

    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.strokeRect(x, y, barW, barH);

    ctx.fillStyle = "rgba(232,238,248,.85)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`boss ${Math.max(0, Math.floor(b.hp))}`, x, y - 6);
  }

  // 초기 화면
  reset();
  fit();
  requestAnimationFrame(tick);
})();