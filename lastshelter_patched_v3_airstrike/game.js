/* /game.js */
(() => {
  const canvas = document.getElementById("c");
  const ctx = canvas.getContext("2d", { alpha: false });

  const uiStage = document.getElementById("uiStage");
  const uiAllies = document.getElementById("uiAllies");
  const uiDps = document.getElementById("uiDps");

  const uiAir = document.getElementById("uiAir");
  const uiFreeze = document.getElementById("uiFreeze");

  const btnPause = document.getElementById("btnPause");
  const btnAir = document.getElementById("btnAir");
  const btnFreeze = document.getElementById("btnFreeze");
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

  // =====================
  // ASSETS
  // =====================
  const IMG = {};
  const IMG_SRC = {
    stage: "./images/stage.png",
    hero: "./images/i.png",
    zombie1: "./images/zombi.png",
    zombie2: "./images/zombi2.png",
    boss: "./images/boss.png",
    cardAllies: "./images/allies_item.png",
    cardFireRate: "./images/fireRate_item.png",
  };

  function loadImages() {
    const keys = Object.keys(IMG_SRC);
    let loaded = 0;

    return new Promise((resolve) => {
      keys.forEach((k) => {
        const im = new Image();
        im.src = IMG_SRC[k];
        im.onload = () => {
          loaded += 1;
          IMG[k] = im;
          if (loaded === keys.length) resolve();
        };
        im.onerror = () => {
          loaded += 1;
          IMG[k] = im;
          if (loaded === keys.length) resolve();
        };
      });
    });
  }

  // =====================
  // SOUNDS
  // =====================
  const SOUND_SRC = {
    boom: "./sound/boom.mp3",
    get: "./sound/get.mp3",
    gun: "./sound/gun2.mp3",
    mg: "./sound/machine-gun.mp3",
    zombie: "./sound/zombie-sound.mp3",
    boss: "./sound/zombie-boss.mp3",
    call: "./sound/zombie-call.mp3",
  };

  function loadSounds() {
    const keys = Object.keys(SOUND_SRC);
    let loaded = 0;
    const SND = {};

    return new Promise((resolve) => {
      keys.forEach((k) => {
        const a = new Audio();
        a.src = SOUND_SRC[k];
        a.preload = "auto";
        a.addEventListener("canplaythrough", () => {
          loaded += 1;
          SND[k] = a;
          if (loaded === keys.length) {
            // adjust default volumes to keep gun prominent
            try {
              if (SND.die) SND.die.volume = 0.18;      // 몬스터 죽는 소리 - 멀리서 나게
              if (SND.zombie) SND.zombie.volume = 0.12; // 좀비 소리 - 원거리
              if (SND.boss) SND.boss.volume = 0.14;     // 보스 소리 - 원거리
              if (SND.gun) { SND.gun.volume = 0.95; SND.gun.loop = true; }
              if (SND.mg) { SND.mg.volume = 0.85; SND.mg.loop = true; }
              if (SND.boom) SND.boom.volume = 0.9;
              if (SND.get) SND.get.volume = 0.9;
              if (SND.call) SND.call.volume = 0.75;
            } catch (e) {}
            state.sounds = SND;
            resolve(SND);
          }
        }, { once: true });
        a.addEventListener("error", () => {
          loaded += 1;
          SND[k] = a;
          if (loaded === keys.length) {
            try {
              if (SND.die) SND.die.volume = 0.18;
              if (SND.zombie) SND.zombie.volume = 0.12;
              if (SND.boss) SND.boss.volume = 0.14;
              if (SND.gun) { SND.gun.volume = 0.95; SND.gun.loop = true; }
              if (SND.mg) { SND.mg.volume = 0.85; SND.mg.loop = true; }
              if (SND.boom) SND.boom.volume = 0.9;
              if (SND.get) SND.get.volume = 0.9;
              if (SND.call) SND.call.volume = 0.75;
            } catch (e) {}
            state.sounds = SND;
            resolve(SND);
          }
        }, { once: true });
      });
    });
  }

  // PNG 중앙 정렬(앵커)
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

  // =====================
  // TUNING
  // =====================
  const TUNE = {
    // increased sizes to better match background scale
    heroSize: 55,
    allySize: 48,
    zombieSizeMin: 43,
    zombieSizeMax: 55,
    bossSize: 260,

    heroHitMul: 0.26,
    allyHitMul: 0.24,
    zombieHitMul: 0.26,
    bossHitMul: 0.28,

    stageScrollSpeed: 120,
    parallaxXMul: 0.18,
    parallaxYMul: 0.06,

    smokeSpawnPerSec: 6,

    pickupSize: 46,
    pickupHitR: 18,
  };

  // =====================
  // GAME STATE
  // =====================
  const state = {
    running: false,
    paused: false,
    time: 0,
    stage: 1,
    wave: 0,

    roadW: 420,

    leaderX: 0,
    leaderY: 0,

    targetX: 0,
    targetY: 0,

    moveSpeed: 420,

    allies: 1,
    baseDmg: 10,
    fireRate: 6,
    bulletSpeed: 720,
    spread: 0.06,

    bullets: [],
    zombies: [],
    particles: [], // 폭발
    smokes: [],

    gate: null,
    gateCooldown: 0,

    boss: null,
    bossEveryWaves: 5,

    stageScroll: 0,
    smokeAcc: 0,

    // airstrike item
    airCharges: 0,
    airDropCd: 0,
    pickups: [],
    airAnim: null,
    flashT: 0,
    muzzleFlashes: [],

    // freeze item
    freezeCharges: 0,
    freezeT: 0,        // 남은 프리즈 시간
    freezeDropCd: 0,

    // die sound cooldown (throttle frequent death sounds)
    dieSoundCd: 0,

    // camera shake (boss stomp)
    shakeT: 0,
    shakeTMax: 0,
    shakeMag: 0,

    assetsReady: false,
  };

  function reset() {
    // 총소리 정지
    try {
      const s = state.sounds && (state.sounds.gun || state.sounds.mg);
      if (s && !s.paused) s.pause();
    } catch (e) {}
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
    state.smokes.length = 0;
    state.muzzleFlashes.length = 0;

    state.gate = null;
    state.gateCooldown = 0;

    state.boss = null;

    state.stageScroll = 0;
    state.smokeAcc = 0;

    state.airCharges = 0;
    state.airDropCd = 0;
    state.pickups.length = 0;
    state.airAnim = null;
    state.flashT = 0;

    state.freezeCharges = 0;
    state.freezeT = 0;
    state.freezeDropCd = 0;

    state.dieSoundCd = 0;

    state.shakeT = 0;
    state.shakeTMax = 0;
    state.shakeMag = 0;

    uiStage.textContent = state.stage;
    uiAllies.textContent = state.allies;
    uiDps.textContent = Math.round(state.allies * state.baseDmg * state.fireRate);
    if (uiAir) uiAir.textContent = state.airCharges;
    if (uiFreeze) uiFreeze.textContent = state.freezeCharges;
  }

  function getRoadBounds() {
    const w = canvas.getBoundingClientRect().width;
    const h = canvas.getBoundingClientRect().height;

    const roadW = Math.min(state.roadW, w - 24);
    const left = (w - roadW) / 2;
    const right = left + roadW;

    const top = h * 0.45;
    const bottom = h * 0.88;

    return { w, h, roadW, left, right, top, bottom };
  }

  // =====================
  // WAVES
  // =====================
  function spawnWave() {
    state.wave += 1;

    const { left, right, top } = getRoadBounds();

    // stage1 wave1: 13~20 (절반)
    const baseMin = 13;
    const baseMax = 20;

    const stageGrowth = (state.stage - 1) * 6;
    const waveGrowth = (state.wave - 1) * 2;

    const minCount = baseMin + stageGrowth + waveGrowth;
    const maxCount = baseMax + stageGrowth + waveGrowth;

    const count = Math.floor(rand(minCount, maxCount));

    const hpBase = 18;
    const hpGrowth = 6;
    const hp = hpBase + (state.stage - 1) * hpGrowth;

    // 속도 15% 감소
    const speedMul = 0.85;

    for (let i = 0; i < count; i++) {
      const baseSize = rand(TUNE.zombieSizeMin, TUNE.zombieSizeMax);

      const targetX = rand(left + 16, right - 16); // 최종 도달 x (도로 너비 내)
      const cx = (left + right) / 2;               // 소실점 중앙에서 시작
      // 도시 소실점 근처에서 시작 (하늘에서 떨어지는 현상 방지)
      const y = rand(top - 480, top - 5);

      const baseSpeed = rand(46, 86) + state.stage * 3;
      const spd = baseSpeed * speedMul;

      state.zombies.push({
        x: cx, targetX, y,
        baseSize,
        size: baseSize,
        scale: 1,
        hitR: baseSize * TUNE.zombieHitMul,
        hp: hp + rand(-3, 6),
        maxHp: hp,
        spd,
        type: Math.random() < 0.5 ? 1 : 2,
        swaySeed: rand(0, 9999),
      });
    }

    if (state.wave % state.bossEveryWaves === 0) {
      spawnBoss();
    }
  }

  function spawnBoss() {
    const { left, right, top } = getRoadBounds();
    const maxHp = 2200 + (state.stage - 1) * 900;
    const baseSize = TUNE.bossSize;

    state.boss = {
      x: (left + right) / 2,
      y: top - 500,       // 소실점 위에서 시작 (원근법)
      baseSize,
      size: baseSize * 0.04,
      scale: 0.04,
      hitR: baseSize * 0.04 * TUNE.bossHitMul,
      hp: maxHp,
      maxHp,
      spd: 22 + state.stage * 2,
      stompT: 0,
      walkT: 0,           // 걷기 애니메이션 타이머
    };

    showToast("boss 등장");
  }


  // =====================
  // AIRSTRIKE ITEM
  // =====================
  function grantAirstrike(n = 1) {
    const before = state.airCharges;
    state.airCharges = clamp(state.airCharges + n, 0, 3);
    if (uiAir) uiAir.textContent = state.airCharges;
    if (state.airCharges > before) showToast("폭격 요청 +1");
  }

  function spawnAirstrikePickup(x, y) {
    state.pickups.push({
      type: "air",
      x, y,
      vy: rand(20, 50),
      bob: rand(0, Math.PI * 2),
      t: 10.0,
    });
  }

  function spawnFreezePickup(x, y) {
    state.pickups.push({
      type: "freeze",
      x, y,
      vy: rand(20, 50),
      bob: rand(0, Math.PI * 2),
      t: 10.0,
    });
  }

  function useFreeze() {
    if (!state.running || state.paused) return;
    if (state.freezeCharges <= 0) { showToast("프리즈 아이템 없음"); return; }
    state.freezeCharges -= 1;
    state.freezeT = 5.0;
    if (uiFreeze) uiFreeze.textContent = state.freezeCharges;
    showToast("❄ 프리즈!");
  }

  function startAirstrike() {
    if (!state.running || state.paused) return;
    if (state.airCharges <= 0) { showToast("폭격 아이템 없음"); return; }
    if (state.airAnim) return;

    state.airCharges -= 1;
    if (uiAir) uiAir.textContent = state.airCharges;

    const { w, h, roadW } = getRoadBounds();
    const cx = w / 2;
    const half = roadW * 0.20; // 중앙 스트립
    const victims = [];

    for (let i = 0; i < state.zombies.length; i++) {
      const z = state.zombies[i];
      if (Math.abs(z.x - cx) <= half && z.y > -40 && z.y < h + 80) {
        z._air = true;
        victims.push({ x: z.x, y: z.y });
      }
    }

    state.airAnim = {
      t: 0,
      victims,
      cx,
      half,
      phase: "warn",
      bombs: [],
      didStrike: false,
    };

    // play warning / call sound
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

    // phases: 0~0.55 warn, 0.55~0.9 bombs, 0.9~1.25 strike+fade
    if (a.t < 0.55) {
      a.phase = "warn";
    } else if (a.t < 0.90) {
      if (a.phase !== "bombs") {
        a.phase = "bombs";
        // spawn bombs that fall toward victims
        const { h } = getRoadBounds();
        const list = (a.victims.length > 0) ? a.victims : [{ x: a.cx, y: h * 0.35 }];
        for (let i = 0; i < Math.min(10, list.length); i++) {
          const v = list[Math.floor(rand(0, list.length))];
          a.bombs.push({
            x: v.x + rand(-12, 12),
            y: -60 - rand(0, 120),
            vy: rand(900, 1200),
            tx: v.x,
            ty: v.y,
          });
        }
        // play bomb/plane sound when bombs spawn
        try {
          const s = state.sounds && (state.sounds.mg || state.sounds.gun);
          if (s) { s.currentTime = 0; s.play().catch(() => {}); }
        } catch (e) {}
      }
      // update bombs
      for (let i = 0; i < a.bombs.length; i++) {
        const b = a.bombs[i];
        b.y += b.vy * dt;
      }
    } else {
      a.phase = "strike";
      if (!a.didStrike) {
        a.didStrike = true;

        // big flash + camera shake
        state.flashT = 0.18;
        state.shakeTMax = 0.30;
        state.shakeT = state.shakeTMax;
        state.shakeMag = 11;

        // kill all marked zombies at once (no per-zombie explode to avoid frame freeze)
        for (let i = state.zombies.length - 1; i >= 0; i--) {
          const z = state.zombies[i];
          if (z._air) {
            // 파티클만 소량 생성 (개별 explode 호출 금지)
            for (let j = 0; j < 3; j++) {
              const a = rand(0, Math.PI * 2);
              const s = rand(40, 140);
              state.particles.push({ x: z.x, y: z.y, vx: Math.cos(a)*s, vy: Math.sin(a)*s, r: rand(1,2.5), t: rand(0.2,0.5) });
            }
            state.zombies.splice(i, 1);
          }
        }
        // 폭발 이펙트는 폭탄 착지점에만 몇 개
        for (let i = 0; i < Math.min(5, a.bombs.length); i++) {
          const b = a.bombs[i];
          explode(b.tx, b.ty, 80, 999999);
        }
        if (a.bombs.length === 0) explode(a.cx, getRoadBounds().h * 0.5, 80, 999999);

        // cleanup flags
        for (let i = 0; i < state.zombies.length; i++) state.zombies[i]._air = false;
      }

      if (a.t > 1.25) state.airAnim = null;
    }
  }

  function drawAirstrikeFx() {
    if (!state.airAnim) return;
    const { w, h } = getRoadBounds();
    const a = state.airAnim;

    // warning zone
    const alpha = a.phase === "warn" ? (0.25 + 0.15 * Math.sin(state.time * 18)) : 0.12;
    ctx.save();
    ctx.fillStyle = `rgba(255,75,75,${alpha})`;
    ctx.fillRect(a.cx - a.half, 0, a.half * 2, h);
    ctx.strokeStyle = `rgba(255,150,150,${0.45 + 0.25 * Math.sin(state.time * 10)})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.strokeRect(a.cx - a.half, 10, a.half * 2, h - 20);
    ctx.setLineDash([]);

    // crosshair
    ctx.strokeStyle = "rgba(255,210,210,.55)";
    ctx.beginPath();
    ctx.moveTo(a.cx - 18, h * 0.18); ctx.lineTo(a.cx + 18, h * 0.18);
    ctx.moveTo(a.cx, h * 0.18 - 18); ctx.lineTo(a.cx, h * 0.18 + 18);
    ctx.stroke();

    // bombs streaks
    if (a.phase === "bombs" || a.phase === "strike") {
      for (let i = 0; i < a.bombs.length; i++) {
        const b = a.bombs[i];
        ctx.strokeStyle = "rgba(255,220,180,.45)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(b.x, b.y - 40);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();

        ctx.fillStyle = "rgba(255,240,220,.85)";
        ctx.beginPath();
        ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  function drawPickups() {
    for (let i = 0; i < state.pickups.length; i++) {
      const p = state.pickups[i];
      const bob = Math.sin(state.time * 4 + p.bob) * 4;
      const isFreeze = p.type === "freeze";

      drawShadow(p.x, p.y + 18 + bob, 14, 5, 0.18);

      ctx.save();
      ctx.translate(p.x, p.y + bob);
      ctx.globalAlpha = 0.92;

      // 배경 원
      ctx.fillStyle = isFreeze ? "rgba(10,20,40,.80)" : "rgba(20,25,35,.75)";
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();

      if (isFreeze) {
        // 눈꽃 (❄) 아이콘
        ctx.strokeStyle = "rgba(100,210,255,.95)";
        ctx.lineWidth = 2;
        // 6방향 가지
        for (let a = 0; a < 6; a++) {
          const ang = (a * Math.PI) / 3;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(Math.cos(ang) * 11, Math.sin(ang) * 11);
          ctx.stroke();
          // 짧은 가지
          const bx = Math.cos(ang) * 7; const by = Math.sin(ang) * 7;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + Math.cos(ang + 0.8) * 4, by + Math.sin(ang + 0.8) * 4);
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + Math.cos(ang - 0.8) * 4, by + Math.sin(ang - 0.8) * 4);
          ctx.stroke();
        }
        ctx.fillStyle = "rgba(180,240,255,.95)";
        ctx.font = "10px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("ICE", 0, 26);
        ctx.textAlign = "left";
      } else {
        // 조준경 (airstrike)
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

  // =====================
  // GATES
  // =====================
  function makeGateOptions() {
    const opts = [
      { key: "add2", label: "+2 allies", icon: "cardAllies", apply() { state.allies += 2; } },
      { key: "add5", label: "+5 allies", icon: "cardAllies", apply() { state.allies += 5; } },
      { key: "rate", label: "fire rate +20%", icon: "cardFireRate", apply() { state.fireRate *= 1.2; } },
      { key: "dmg", label: "damage +25%", icon: null, apply() { state.baseDmg *= 1.25; } },
      { key: "speed", label: "bullet speed +15%", icon: null, apply() { state.bulletSpeed *= 1.15; } },
      { key: "spread", label: "spread -15%", icon: null, apply() { state.spread *= 0.85; } },
      { key: "turret", label: "turret burst", icon: null, apply() { burstTurret(); } },
      { key: "nuke", label: "airstrike +1", icon: null, apply() { grantAirstrike(1); } },
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
    const { top } = getRoadBounds();
    const [optL, optR] = makeGateOptions();
    const cardHp = 50 + state.stage * 10;

    state.gate = {
      y: top - 480,       // 좀비처럼 소실점 위에서 시작
      baseW: 120,         // 2배 크기
      baseH: 44,          // 2배 크기
      speed: 70 + state.stage * 5,  // 속도 절반 이하로 감속
      scale: 0.04,
      effW: 0, effH: 0,
      leftOpt: optL,
      leftHp: cardHp, leftMaxHp: cardHp, leftDead: false,
      leftX: 0, leftY: 0,
      rightOpt: optR,
      rightHp: cardHp, rightMaxHp: cardHp, rightDead: false,
      rightX: 0, rightY: 0,
    };
  }

  // =====================
  // EFFECTS
  // =====================
  function burstTurret() {
    const { w } = getRoadBounds();
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
          showToast("boss 처치");
        }
      }
    }

    // 폭발 파티클
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

    // 폭발 연기(더 오래)
    for (let i = 0; i < 8; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(20, 80);
      state.smokes.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - rand(10, 40),
        r: rand(10, 24),
        t: rand(0.8, 1.4),
        a: rand(0.22, 0.34),
      });
    }
    // play explosion sound
    try {
      const s = state.sounds && state.sounds.boom;
      if (s) { s.currentTime = 0; s.play().catch(() => {}); }
    } catch (e) {}
  }

  function killZombie(idx, z, pcount = 6) {
    state.zombies.splice(idx, 1);
    // play die sound (throttled)
    try {
      if (state.dieSoundCd <= 0) {
        const s = state.sounds && state.sounds.die;
        if (s) { s.currentTime = 0; s.play().catch(() => {}); }
        // throttle subsequent die sounds for a short window
        state.dieSoundCd = 0.65;
      }
    } catch (e) {}
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

    // 죽을 때 연기
    state.smokes.push({
      x: z.x,
      y: z.y,
      vx: rand(-20, 20),
      vy: rand(-40, -20),
      r: rand(14, 22),
      t: rand(0.9, 1.6),
      a: rand(0.18, 0.28),
    });

    // chance to drop airstrike item
    if (state.airCharges < 3 && state.airDropCd <= 0 && Math.random() < 0.035) {
      spawnAirstrikePickup(z.x, z.y);
      state.airDropCd = 3.6;
    }
    // chance to drop freeze item
    if (state.freezeCharges < 3 && state.freezeDropCd <= 0 && Math.random() < 0.05) {
      spawnFreezePickup(z.x, z.y);
      state.freezeDropCd = 4.0;
    }

  }

  // =====================
  // FORMATION
  // =====================
  function getAllyPositions() {
    const { w, roadW, top, bottom } = getRoadBounds();

    const maxX = roadW * 0.42;
    const leaderX = clamp(state.leaderX, -maxX, maxX);
    const leaderY = clamp(state.leaderY, top, bottom);

    const spacingX = 18;
    const spacingY = 18;

    const res = [];
    let remain = state.allies;
    let row = 0;
    while (remain > 0 && row < 6) {
      const cap = 5 + row * 2;
      const take = Math.min(remain, cap);
      for (let i = 0; i < take; i++) {
        const offset = (i - (take - 1) / 2) * spacingX;
        res.push({ x: w / 2 + (leaderX + offset), y: leaderY + row * spacingY });
      }
      remain -= take;
      row += 1;
    }

    return res;
  }

  // =====================
  // INPUT
  // =====================
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

  const keys = new Set();
  window.addEventListener("keydown", (e) => {
    keys.add(e.key);
    // handle airstrike hotkey (use code to avoid locale issues)
    if (e.code === "KeyF") {
      e.preventDefault();
      startAirstrike();
    }
    if (e.code === "KeyS" && !e.repeat) {
      e.preventDefault();
      useFreeze();
    }
  });
  window.addEventListener("keyup", (e) => keys.delete(e.key));

  // =====================
  // UI
  // =====================
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
    if (state.paused) stopGunSound();
  });

  btnRestart.addEventListener("click", () => {
    reset();
    overlay.classList.remove("hidden");
    ovTitle.textContent = "ready";
    ovDesc.textContent = "click / tap to start";
    btnPause.textContent = "pause";
  });


  if (btnAir) {
    btnAir.addEventListener("click", () => startAirstrike());
  }
  if (btnFreeze) {
    btnFreeze.addEventListener("click", () => useFreeze());
  }

  // hotkey handled in consolidated keydown listener above

  btnStart.addEventListener("click", startGame);

  function startGame() {
    if (!state.assetsReady) return;

    reset(); // 죽은 상태에서 재시작해도 완전 초기화
    overlay.classList.add("hidden");
    state.running = true;
    state.paused = false;
    btnPause.textContent = "pause";
    showToast("start");

    const { top, bottom } = getRoadBounds();
    state.leaderY = lerp(top, bottom, 0.9);
    state.targetY = state.leaderY;

    spawnWave();
  }

  // =====================
  // LOOP
  // =====================
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

  // =====================
  // COMBAT
  // =====================
  let shootAcc = 0;

  function autoShoot(dt) {
    shootAcc += dt;
    const interval = 1 / state.fireRate;

    let tx = null;
    let ty = null;

    // 가장 아래쪽 좀비 우선
    let best = null;
    let bestY = -1e9;
    for (let i = 0; i < state.zombies.length; i++) {
      const z = state.zombies[i];
      if (z.y > bestY) { bestY = z.y; best = z; }
    }

    if (state.boss) {
      tx = state.boss.x;
      ty = state.boss.y + state.boss.size * 0.1;
    } else if (best) {
      tx = best.x;
      ty = best.y;
    }

    // 좀비/보스 없으면 총소리 정지
    if (tx == null) {
      try {
        const s = state.sounds && (state.sounds.gun || state.sounds.mg);
        if (s && !s.paused) s.pause();
      } catch (e) {}
      return;
    }

    // 좀비 있으면 총소리 루프 재생 (이미 재생 중이면 그대로)
    try {
      const s = state.sounds && (state.sounds.gun || state.sounds.mg);
      if (s && s.paused) s.play().catch(() => {});
    } catch (e) {}

    const alliesPos = getAllyPositions();

    while (shootAcc >= interval) {
      shootAcc -= interval;

      for (let i = 0; i < alliesPos.length; i++) {
        const p = alliesPos[i];
        const ang = Math.atan2(ty - p.y, tx - p.x) + rand(-state.spread, state.spread);
        const spd = state.bulletSpeed;

        state.bullets.push({
          x: p.x,
          y: p.y - 10,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd,
          dmg: state.baseDmg,
          r: 2.0,
          ttl: 1.25,
          pierce: 1
        });
        // 머즐 플래시
        state.muzzleFlashes.push({ x: p.x, y: p.y - 10, ang, t: 0.09 });
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
        const rr = z.hitR + b.r;

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

          if (z.hp <= 0) killZombie(zi, z, 7);

          b.pierce -= 1;
          if (b.pierce <= 0) break;
        }
      }

      if (state.boss && b.pierce > 0) {
        const boss = state.boss;
        const dx = boss.x - b.x;
        const dy = (boss.y + boss.size * 0.1) - b.y;
        const rr = boss.hitR + b.r;

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

      // 아이템 카드 히트
      if (state.gate && b.pierce > 0) {
        const g = state.gate;
        const checkCard = (cx, cy, cw, ch, isLeft) => {
          if (b.x >= cx && b.x <= cx + cw && b.y >= cy && b.y <= cy + ch) {
            if (isLeft && !g.leftDead) {
              g.leftHp -= b.dmg;
              hit = true;
              b.pierce = 0;
              state.particles.push({ x: b.x, y: b.y, vx: rand(-30,30), vy: rand(-30,30), r: rand(1,2), t: rand(0.1,0.2) });
              if (g.leftHp <= 0) {
                g.leftDead = true;
                g.leftOpt.apply();
                showToast(`획득: ${g.leftOpt.label}`);
                uiAllies.textContent = state.allies;
                uiDps.textContent = Math.round(state.allies * state.baseDmg * state.fireRate);
              }
            } else if (!isLeft && !g.rightDead) {
              g.rightHp -= b.dmg;
              hit = true;
              b.pierce = 0;
              state.particles.push({ x: b.x, y: b.y, vx: rand(-30,30), vy: rand(-30,30), r: rand(1,2), t: rand(0.1,0.2) });
              if (g.rightHp <= 0) {
                g.rightDead = true;
                g.rightOpt.apply();
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

  // =====================
  // CONTACT DEATH (정확한 히트박스)
  // =====================
  function contactDeaths() {
    const alliesPos = getAllyPositions();
    if (alliesPos.length === 0) return;

    const { top, bottom } = getRoadBounds();
    let hitIndex = -1;

    for (let i = 0; i < alliesPos.length; i++) {
      const a = alliesPos[i];
      const depthT = clamp((a.y - top) / (bottom - top), 0, 1);
      const allyHitR = TUNE.allySize * TUNE.allyHitMul * lerp(0.45, 1.0, depthT);
      for (let zi = 0; zi < state.zombies.length; zi++) {
        const z = state.zombies[zi];
        const dx = z.x - a.x, dy = z.y - a.y;
        const rr = z.hitR + allyHitR;
        if (dx * dx + dy * dy <= rr * rr) { hitIndex = i; break; }
      }
      if (hitIndex !== -1) break;
    }

    // 보스 접촉
    if (hitIndex === -1 && state.boss) {
      const b = state.boss;
      for (let i = 0; i < alliesPos.length; i++) {
        const a = alliesPos[i];
        const depthT = clamp((a.y - top) / (bottom - top), 0, 1);
        const allyHitR = TUNE.allySize * TUNE.allyHitMul * lerp(0.45, 1.0, depthT);
        const dx = b.x - a.x, dy = (b.y + b.size * 0.1) - a.y;
        const rr = b.hitR + allyHitR;
        if (dx * dx + dy * dy <= rr * rr) { hitIndex = i; break; }
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
        state.particles.push({
          x: p.x, y: p.y,
          vx: Math.cos(a) * s,
          vy: Math.sin(a) * s,
          r: rand(1.2, 3.2),
          t: rand(0.18, 0.55),
        });
      }

      if (state.allies <= 0) {
        state.running = false;
        stopGunSound();
        overlay.classList.remove("hidden");
        ovTitle.textContent = "dead";
        ovDesc.textContent = "zombie contact";
      }
    }
  }

  // =====================
  // UPDATE
  // =====================
  function update(dt) {
    const { w, h, roadW, top, bottom, left, right } = getRoadBounds();
    if (!state.running || state.paused) return;

    state.time += dt;

    // airstrike animation / timing
    updateAirstrike(dt);

    // flash decay
    if (state.flashT > 0) {
      state.flashT -= dt;
      if (state.flashT < 0) state.flashT = 0;
    }

    // freeze timer
    if (state.freezeT > 0) {
      state.freezeT -= dt;
      if (state.freezeT < 0) state.freezeT = 0;
    }
    if (state.freezeDropCd > 0) {
      state.freezeDropCd -= dt;
      if (state.freezeDropCd < 0) state.freezeDropCd = 0;
    }

    // pickup drop cooldown
    if (state.airDropCd > 0) {
      state.airDropCd -= dt;
      if (state.airDropCd < 0) state.airDropCd = 0;
    }

    // die sound cooldown
    if (state.dieSoundCd > 0) {
      state.dieSoundCd -= dt;
      if (state.dieSoundCd < 0) state.dieSoundCd = 0;
    }


    // camera shake decay
    if (state.shakeT > 0) {
      state.shakeT -= dt;
      if (state.shakeT < 0) state.shakeT = 0;
    }

    // smoke ambient
    state.smokeAcc += dt * TUNE.smokeSpawnPerSec;
    while (state.smokeAcc >= 1) {
      state.smokeAcc -= 1;
      const x = rand(left + 20, right - 20);
      const y = rand(bottom - 10, h + 40);
      state.smokes.push({
        x, y,
        vx: rand(-10, 10),
        vy: rand(-50, -20),
        r: rand(10, 20),
        t: rand(1.2, 2.3),
        a: rand(0.06, 0.12),
      });
    }

    // movement
    const maxX = roadW * 0.42;

    let kx = 0, ky = 0;
    if (keys.has("ArrowLeft") || keys.has("a")) kx -= 1;
    if (keys.has("ArrowRight") || keys.has("d")) kx += 1;
    if (keys.has("ArrowUp") || keys.has("w")) ky -= 1;
    if (keys.has("ArrowDown")) ky += 1; // S키는 freeze 전용이므로 제외

    const usingKeyboard = (kx !== 0 || ky !== 0);

    if (usingKeyboard) {
      const len = Math.hypot(kx, ky) || 1;
      kx /= len; ky /= len;

      state.leaderX += kx * state.moveSpeed * dt;
      state.leaderY += ky * state.moveSpeed * dt;

      state.targetX = state.leaderX;
      state.targetY = state.leaderY;
    } else {
      state.leaderX = lerp(state.leaderX, state.targetX, 0.18);
      state.leaderY = lerp(state.leaderY, state.targetY, 0.20);
    }

    state.leaderX = clamp(state.leaderX, -maxX, maxX);
    state.leaderY = clamp(state.leaderY, top, bottom);

    // shoot
    autoShoot(dt);

    // bullets
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.ttl -= dt;
      if (b.ttl <= 0 || b.y < -80 || b.y > h + 80 || b.x < -80 || b.x > w + 80) {
        state.bullets.splice(i, 1);
      }
    }

    // zombies: top -> bottom only
    // + perspective scaling (bigger when closer)
    // + x: 소실점 중앙에서 퍼지며 접근 (난간 이탈 방지)
    const zombieCX = (left + right) / 2;
    const spawnZone = top - 480;
    for (let i = state.zombies.length - 1; i >= 0; i--) {
      const z = state.zombies[i];
      if (state.freezeT <= 0) z.y += z.spd * dt; // 프리즈 중 정지

      // 원근 depth
      const depthT = clamp((z.y - spawnZone) / (bottom - spawnZone), 0, 1);

      // X: 중앙(소실점) → targetX (가까울수록 벌어짐) + 깊이 비례 sway
      z.x = lerp(zombieCX, z.targetX, depthT)
            + Math.sin(state.time * 6 + z.swaySeed) * 0.10 * depthT;

      // 크기
      z.scale = lerp(0.04, 1.35, depthT);
      z.size = z.baseSize * z.scale;
      z.hitR = z.size * TUNE.zombieHitMul;

      if (z.y > h + 90) state.zombies.splice(i, 1);
    }

    // boss
    if (state.boss) {
      const b = state.boss;
      if (state.freezeT <= 0) b.y += b.spd * dt; // 프리즈 중 정지
      b.stompT += dt;
      b.walkT += dt;

      // 원근 스케일 (좀비와 동일 공식)
      const bossSpawnZone = top - 500;
      const bossDepthT = clamp((b.y - bossSpawnZone) / (bottom - bossSpawnZone), 0, 1);
      b.scale = lerp(0.04, 1.0, bossDepthT);
      b.size = b.baseSize * b.scale;
      b.hitR = b.size * TUNE.bossHitMul;

      if (b.stompT > 2.8) {
        b.stompT = 0;
        explode(b.x, b.y + b.size * 0.2, 90, state.baseDmg * 6);

        // boss stomp camera shake
        state.shakeTMax = 0.20;
        state.shakeT = state.shakeTMax;
        state.shakeMag = 7 + Math.min(6, state.stage);
      }

      if (b.y > 170) b.spd = 36 + state.stage * 3;

      if (b.y > h * 0.90) {
        state.running = false;
        stopGunSound();
        overlay.classList.remove("hidden");
        ovTitle.textContent = "overrun";
        ovDesc.textContent = "restart to try again";
      }
    }

    // collisions
    bulletCollisions();
    contactDeaths();

    // pickups (airstrike)
    const px = w / 2 + state.leaderX;
    const py = state.leaderY;

    for (let i = state.pickups.length - 1; i >= 0; i--) {
      const p = state.pickups[i];
      p.y += p.vy * dt;
      p.vy *= 0.985;
      p.t -= dt;

      // auto pick up near leader
      const d = Math.hypot(p.x - px, p.y - py);
      if (d < 34) {
        try {
          const s = state.sounds && state.sounds.get;
          if (s) { s.currentTime = 0; s.play().catch(() => {}); }
        } catch (e) {}
        state.pickups.splice(i, 1);
        if (p.type === "freeze") {
          state.freezeCharges = Math.min(3, state.freezeCharges + 1);
          if (uiFreeze) uiFreeze.textContent = state.freezeCharges;
          showToast("❄ 프리즈 아이템 획득");
        } else {
          grantAirstrike(1);
        }
        continue;
      }

      if (p.t <= 0 || p.y > h + 80) {
        state.pickups.splice(i, 1);
      }
    }


    // gate spawn
    state.gateCooldown -= dt;
    if (!state.gate && state.gateCooldown <= 0 && state.time > 2.0) {
      if (state.zombies.length < 28 && (!state.boss || state.boss.hp < state.boss.maxHp * 0.85)) {
        spawnGate();
      }
    }

    // gate update (perspective + HP 시스템)
    if (state.gate) {
      const g = state.gate;
      g.y += g.speed * dt;

      // 원근 스케일 (좀비와 동일 공식)
      const spawnZone = top - 480;
      const depthT = clamp((g.y - spawnZone) / (bottom - spawnZone), 0, 1);
      g.scale = lerp(0.04, 1.0, depthT);
      g.effW = g.baseW * g.scale;
      g.effH = g.baseH * g.scale;

      // 카드 좌우 위치 (원근에 따라 벌어짐)
      const cx = w / 2;
      const halfGap = 90 * g.scale;
      g.leftX  = cx - halfGap - g.effW / 2;
      g.leftY  = g.y - g.effH / 2;
      g.rightX = cx + halfGap - g.effW / 2;
      g.rightY = g.y - g.effH / 2;

      // 화면 아래로 나가면 제거
      if (g.y > h + 120) {
        state.gate = null;
        state.gateCooldown = 2.2;
      }
      // 둘 다 처치되면 제거
      if (state.gate && g.leftDead && g.rightDead) {
        state.gate = null;
        state.gateCooldown = 2.5;
      }
    }

    // muzzle flashes
    for (let i = state.muzzleFlashes.length - 1; i >= 0; i--) {
      state.muzzleFlashes[i].t -= dt;
      if (state.muzzleFlashes[i].t <= 0) state.muzzleFlashes.splice(i, 1);
    }

    // particles
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(0.001, dt);
      p.vy *= Math.pow(0.001, dt);
      p.t -= dt;
      if (p.t <= 0) state.particles.splice(i, 1);
    }

    // smokes
    for (let i = state.smokes.length - 1; i >= 0; i--) {
      const s = state.smokes[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 0.995;
      s.vy *= 0.995;
      s.r += dt * 8;
      s.t -= dt;
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

  // =====================
  // RENDER
  // =====================
  function drawStage() {
    const { w, h } = getRoadBounds();

    // 요구사항: 배경은 완전 고정
    const px = 0;
    const py = 0;

    const img = IMG.stage;
    if (!img || !img.complete || img.naturalWidth === 0) {
      ctx.fillStyle = "#0b0f14";
      ctx.fillRect(0, 0, w, h);
      return;
    }

    // cover scaling
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    const scale = Math.max(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;

    // fixed cover (single draw)
    const x = (w - dw) / 2 + px;
    const y = (h - dh) / 2 + py;
    ctx.drawImage(img, x, y, dw, dh);

    // subtle dark overlay for readability
    ctx.fillStyle = "rgba(0,0,0,.25)";
    ctx.fillRect(0, 0, w, h);

    // 하늘 마스크: 소실점 위 영역을 어둡게 가려서 좀비가 도시에서 나오는 것처럼 보임
    const { top } = getRoadBounds();
    const skyGrad = ctx.createLinearGradient(0, 0, 0, top + 40);
    skyGrad.addColorStop(0,   "rgba(0,0,0,0.92)");
    skyGrad.addColorStop(0.7, "rgba(0,0,0,0.75)");
    skyGrad.addColorStop(1,   "rgba(0,0,0,0)");
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, top + 40);
  }

  function drawRoadFrame() {
    const { w, h, roadW, left, right } = getRoadBounds();

    // road mask (keep background outside darker)
    ctx.fillStyle = "rgba(0,0,0,.35)";
    ctx.fillRect(0, 0, left, h);
    ctx.fillRect(right, 0, w - right, h);

    // edge lines
    ctx.strokeStyle = "rgba(255,255,255,.07)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(left, 0);
    ctx.lineTo(left, h);
    ctx.moveTo(right, 0);
    ctx.lineTo(right, h);
    ctx.stroke();

    // center dashed
    ctx.strokeStyle = "rgba(255,255,255,.06)";
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(w / 2, 0);
    ctx.lineTo(w / 2, h);
    ctx.stroke();
    ctx.setLineDash([]);

    // very subtle vignette
    const vg = ctx.createRadialGradient(w / 2, h * 0.6, 40, w / 2, h * 0.6, Math.max(w, h));
    vg.addColorStop(0, "rgba(0,0,0,0)");
    vg.addColorStop(1, "rgba(0,0,0,.35)");
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);
  }

  function drawShadow(x, y, w, h, alpha = 0.35) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawZombies() {
    // 좀비 그림자 자동
    for (let i = 0; i < state.zombies.length; i++) {
      const z = state.zombies[i];
      const img = z.type === 1 ? IMG.zombie1 : IMG.zombie2;

      // shadow (speed affects length)
      const spN = clamp((z.spd - 35) / 85, 0, 1);
      const shW = z.size * (0.26 + spN * 0.20);
      const shH = z.size * (0.12 - spN * 0.03);
      drawShadow(z.x, z.y + z.size * 0.22, shW, Math.max(2, shH), 0.32);

      // walking upper-body sway (rotate around feet-ish anchor)
      const freq = 7.0 + spN * 5.0;
      const amp = (0.05 + spN * 0.06) * (0.7 + 0.6 * z.scale);
      const rot = Math.sin(state.time * freq + z.swaySeed) * amp;

      // anchor slightly lower so feet feel planted
      drawImageAnchoredRot(img, z.x, z.y, z.size, z.size, 0.5, 0.62, rot, 1);

      // hp bar
      const hpT = clamp(z.hp / z.maxHp, 0, 1);
      ctx.fillStyle = "rgba(0,0,0,.35)";
      ctx.fillRect(z.x - 14, z.y - z.size * 0.45, 28, 4);
      ctx.fillStyle = "rgba(66,245,161,.85)";
      ctx.fillRect(z.x - 14, z.y - z.size * 0.45, 28 * hpT, 4);
    }
  }

  function drawBoss() {
    if (!state.boss) return;
    const b = state.boss;

    // 그림자 (크기에 비례)
    drawShadow(b.x, b.y + b.size * 0.42, b.size * 0.34, b.size * 0.16, 0.38);

    // 걷기 sway 애니메이션 (좌우 흔들림)
    const walkSway = Math.sin(b.walkT * 2.5) * 0.06;
    drawImageAnchoredRot(IMG.boss, b.x, b.y, b.size, b.size, 0.5, 0.52, walkSway, 1);

    // HP 바 (보스 크기에 비례)
    if (b.size > 30) {
      const hpT = clamp(b.hp / b.maxHp, 0, 1);
      const barW = Math.max(50, b.size * 1.1);
      const barH = Math.max(3, b.size * 0.04);
      const x = b.x - barW / 2;
      const y = b.y - b.size * 0.58;

      ctx.fillStyle = "rgba(0,0,0,.45)";
      ctx.fillRect(x, y, barW, barH);
      ctx.fillStyle = "rgba(255,93,93,.85)";
      ctx.fillRect(x, y, barW * hpT, barH);
      ctx.strokeStyle = "rgba(255,255,255,.18)";
      ctx.strokeRect(x, y, barW, barH);

      if (b.size > 60) {
        ctx.fillStyle = "rgba(232,238,248,.85)";
        ctx.font = `${Math.max(9, Math.floor(b.size * 0.055))}px system-ui, sans-serif`;
        ctx.fillText(`boss ${Math.max(0, Math.floor(b.hp))}`, x, y - 4);
      }
    }
  }

  function drawMuzzleFlashes() {
    for (let i = 0; i < state.muzzleFlashes.length; i++) {
      const f = state.muzzleFlashes[i];
      const frac = f.t / 0.09; // 1→0
      ctx.save();
      ctx.globalAlpha = frac;
      ctx.translate(f.x, f.y);
      ctx.rotate(f.ang);

      // 방사형 불꽃 글로우
      const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, 11);
      grd.addColorStop(0,   "rgba(255,255,200,1)");
      grd.addColorStop(0.4, "rgba(255,140,30,0.85)");
      grd.addColorStop(1,   "rgba(255,60,0,0)");
      ctx.fillStyle = grd;
      ctx.beginPath();
      ctx.arc(0, 0, (9 * frac + 2), 0, Math.PI * 2);
      ctx.fill();

      // 총구 방향 주 줄기
      ctx.strokeStyle = "rgba(255,220,80,0.95)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(2, 0);
      ctx.lineTo(20 * frac, 0);
      ctx.stroke();

      // 옆 가지 (위아래)
      ctx.strokeStyle = "rgba(255,170,40,0.65)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(2, 0); ctx.lineTo(11 * frac, -5 * frac);
      ctx.moveTo(2, 0); ctx.lineTo(11 * frac,  5 * frac);
      ctx.stroke();

      ctx.restore();
    }
  }

  function drawBullets() {
    ctx.fillStyle = "rgba(255,255,255,.95)";
    for (let i = 0; i < state.bullets.length; i++) {
      const b = state.bullets[i];

      // trail
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

      // shadow
      drawShadow(p.x, p.y + 18 * ps, 14 * ps, 6 * ps, 0.25);

      // sprite
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
      // 텍스트는 카드가 충분히 커졌을 때만
      if (h > 14) {
        ctx.fillStyle = "rgba(232,238,248,.95)";
        ctx.font = `bold ${Math.max(8, Math.floor(h * 0.45))}px system-ui`;
        ctx.fillText(opt.label, x + 2, y + h * 0.65);
      }
    }

    // HP 바
    const barH = Math.max(2, h * 0.14);
    const hpRatio = Math.max(0, hp / maxHp);
    ctx.fillStyle = "rgba(0,0,0,.55)";
    ctx.fillRect(x, y + h + 1, w, barH);
    ctx.fillStyle = hpRatio > 0.5 ? "#42f5a1" : hpRatio > 0.25 ? "#ffcc66" : "#ff5d5d";
    ctx.fillRect(x, y + h + 1, w * hpRatio, barH);
  }

  function render() {
    const { w, h, left } = getRoadBounds();

    // boss camera shake
    let sx = 0, sy = 0;
    if (state.shakeT > 0 && state.shakeTMax > 0) {
      const t = state.shakeT / state.shakeTMax;
      const mag = state.shakeMag * t;
      sx = rand(-mag, mag);
      sy = rand(-mag, mag);
    }

    ctx.save();
    ctx.translate(sx, sy);

    // background (fixed)
    drawStage();

    // road frame overlay
    drawRoadFrame();

    // ambient smoke behind units
    drawSmokes();

    // pickups
    drawPickups();

    // gate
    if (state.gate) drawGate(state.gate);

    // enemies
    drawZombies();
    drawBoss();

    // bullets + muzzle flash
    drawBullets();
    drawMuzzleFlashes();

    // allies
    drawAllies();

    // explosions
    drawParticles();

    // airstrike overlay
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
      const sec = Math.ceil(state.freezeT);
      const pulse = 1 + 0.12 * Math.sin(state.time * 10);
      const fontSize = Math.round(88 * pulse);
      ctx.save();
      ctx.textAlign = "center";
      ctx.font = `bold ${fontSize}px system-ui, sans-serif`;
      // 글로우
      ctx.shadowColor = "#88eeff";
      ctx.shadowBlur = 32;
      ctx.fillStyle = "rgba(180,240,255,0.18)";
      ctx.fillText(sec, w / 2, h / 2 + 30);
      // 메인 텍스트
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#cff6ff";
      ctx.fillText(sec, w / 2, h / 2 + 30);
      // FREEZE 라벨
      ctx.font = "bold 18px system-ui, sans-serif";
      ctx.shadowBlur = 8;
      ctx.fillStyle = "rgba(140,220,255,0.9)";
      ctx.fillText("❄ FREEZE", w / 2, h / 2 - 40);
      ctx.shadowBlur = 0;
      ctx.textAlign = "left";
      ctx.restore();

      // 화면 파란 틴트 오버레이
      ctx.save();
      ctx.globalAlpha = 0.08 + 0.04 * Math.sin(state.time * 6);
      ctx.fillStyle = "#88ddff";
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }

    // debug text
    ctx.fillStyle = "rgba(159,176,199,.65)";
    ctx.font = "12px system-ui, sans-serif";
    ctx.fillText(`zombies: ${state.zombies.length}`, left + 10, 18);
  }

  // =====================
  // BOOT
  // =====================
  function boot() {
    reset();
    fit();

    // show loading
    overlay.classList.remove("hidden");
    ovTitle.textContent = "loading";
    ovDesc.textContent = "assets loading...";
    btnStart.disabled = true;

    Promise.all([loadImages(), loadSounds()]).then(() => {
      state.assetsReady = true;
      ovTitle.textContent = "ready";
      ovDesc.textContent = "click / tap to start";
      btnStart.disabled = false;
    }).catch(() => {
      // even if sounds fail, allow game to start
      state.assetsReady = true;
      ovTitle.textContent = "ready";
      ovDesc.textContent = "click / tap to start";
      btnStart.disabled = false;
    });

    requestAnimationFrame(tick);
  }

  boot();
})();
