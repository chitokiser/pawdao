// /game.js
(() => {
  'use strict';

  /* =========================================================
     0) CONFIG (유지보수: 여기만 바꾸면 됨)
  ========================================================= */
  const GAME = {
    topUI: 44,
    margin: 18,
    padTop: 10,
    bucketRadius: 28,

    // 데드라인(빨간 점선)
    deadLineOffset: 34,
    deadFrames: 35,          // 이 프레임 이상 유지되면 게임오버
    spawnBelowDeadPx: 70,    // 스폰 위치(데드라인 아래로)

    // 투하/물리
    dropCooldownFrames: 10,
    physicsIterations: 6,
    maxSpeed: 16,

    // 3개 합체
    mergeCount: 3,
    mergeTouchPaddingPx: 6.0,  // “붙어있음” 판정 여유(기존 문제 해결 핵심)
    mergeLockFrames: 12,

    // (hit 사운드 제거됨)
  };

  const PHYS = {
    g: 0.58,
    air: 0.998,
    wallRest: 0.55,
    floorRest: 0.08,
    ballRest: 0.08,
    friction: 0.985,
  };

  // 과일 11단계(fruit_10까지) — 크기 추가 +25% 난이도 상향
  // images 폴더에 fruit_0.png ... fruit_10.png 넣으면 자동 로드
  // 과일 크기 +40% (난이도 상향)
  const FRUIT_LEVELS = [
    { r: 39,  file: 'fruit_0.png' },
    { r: 46,  file: 'fruit_1.png' },
    { r: 55,  file: 'fruit_2.png' },
    { r: 64,  file: 'fruit_3.png' },
    { r: 76,  file: 'fruit_4.png' },
    { r: 88,  file: 'fruit_5.png' },
    { r: 105, file: 'fruit_6.png' },
    { r: 126, file: 'fruit_7.png' },
    { r: 151, file: 'fruit_8.png' },
    { r: 181, file: 'fruit_9.png' },
    { r: 217, file: 'fruit_10.png' }, // 최대 단계
  ];

  /* =========================================================
     1) DOM / CANVAS
  ========================================================= */
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');

  const scoreEl = document.getElementById('score');
  const overlay = document.getElementById('overlay');
  const btnStart = document.getElementById('btnStart');
  const gameOverEl = document.getElementById('gameOver');
  const btnRestart = document.getElementById('btnRestart');

  canvas.style.touchAction = 'none';

  const wrap = document.getElementById('wrap');

  function resize() {
    canvas.width  = wrap.clientWidth;
    canvas.height = wrap.clientHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  /* =========================================================
     2) UTILS / GEOMETRY
  ========================================================= */
  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function bucketRect() {
    const left = GAME.margin;
    const right = canvas.width - GAME.margin;
    const top = GAME.topUI + GAME.padTop;
    const bottom = canvas.height - GAME.margin;
    return { left, right, top, bottom, radius: GAME.bucketRadius };
  }

  function deadY() {
    const b = bucketRect();
    return b.top + GAME.deadLineOffset;
  }

  // 진동(가능한 기기에서만)
  function vib(ms) {
    if (navigator.vibrate) navigator.vibrate(ms);
  }
  function vibMerge() {
    if (navigator.vibrate) navigator.vibrate([14, 22, 14]);
  }

  /* =========================================================
     3) AUDIO (mp3 우선 + wav 폴백 / 깨짐 방지)
  ========================================================= */
  function createAudio() {
    const poolSize = 6;
    const pool = new Map();
    let unlocked = false;

    function candidates(name) {
      // mp3 우선, 없으면 wav
      return [
        `./sounds/${name}.mp3`,
        `./sounds/${name}.wav`,
      ];
    }

    function getPool(name) {
      if (pool.has(name)) return pool.get(name);

      const arr = [];
      const urls = candidates(name);
      for (let i = 0; i < poolSize; i++) {
        const a = new Audio();
        a.preload = 'auto';
        // 첫 번째 URL 시도 -> 에러면 다음 URL로 교체
        let idx = 0;
        a.src = urls[idx];

        a.addEventListener('error', () => {
          if (idx < urls.length - 1) {
            idx++;
            a.src = urls[idx];
            a.load();
          } else {
            a.__dead = true; // 모든 URL 실패 → 재시도 금지
          }
        });

        arr.push(a);
      }
      pool.set(name, { arr, i: 0 });
      return pool.get(name);
    }

    function unlock() {
      if (unlocked) return;
      unlocked = true;
      // 모바일/크롬 정책: 첫 입력에서만 play 허용
      // 여기서는 play를 강제하지 않고 unlocked 플래그만 사용
    }

    function play(name) {
      if (!unlocked) return;

      const p = getPool(name);
      const a = p.arr[p.i];
      p.i = (p.i + 1) % p.arr.length;

      try {
        if (a.__dead) return; // 실패한 엘리먼트 건너뜀 (재다운로드 방지)
        a.currentTime = 0;
        a.play().catch(() => {});
      } catch (_) {}
    }

    return { unlock, play };
  }

  const audio = createAudio();

  /* =========================================================
     4) ASSETS (images 폴더 로드, 실패하면 SVG 폴백)
  ========================================================= */
  function svgDataUri(svg) {
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function makeFallbackSvg(r, seed = 0) {
    const s = r * 2, cx = r, cy = r;
    const palettes = [
      ['#ff4d6d', '#cc2b3f', '#ffe1e7'],
      ['#ffa53a', '#cc7b22', '#fff0d2'],
      ['#06d6a0', '#049c74', '#d9fff3'],
      ['#4dabf7', '#2b6fb5', '#ddf0ff'],
      ['#9b5de5', '#6e33b7', '#f0e6ff'],
    ];
    const p = palettes[seed % palettes.length];
    const base = p[0], shade = p[1], highlight = p[2];

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
        <defs>
          <radialGradient id="g" cx="30%" cy="25%" r="75%">
            <stop offset="0%" stop-color="${highlight}"/>
            <stop offset="55%" stop-color="${base}"/>
            <stop offset="100%" stop-color="${shade}"/>
          </radialGradient>
        </defs>
        <circle cx="${cx}" cy="${cy}" r="${r*0.98}" fill="url(#g)"/>
        <circle cx="${cx}" cy="${cy}" r="${r*0.98}" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="${Math.max(1, r*0.08)}"/>
      </svg>`;
    const img = new Image();
    img.src = svgDataUri(svg);
    return img;
  }

  function loadImage(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ ok: true, img });
      img.onerror = () => resolve({ ok: false, img: null });
      img.src = url;
    });
  }

  async function loadFruitImages() {
    const imgs = [];
    for (let i = 0; i < FRUIT_LEVELS.length; i++) {
      const file = FRUIT_LEVELS[i].file;
      const url = `./images/${file}`;
      const res = await loadImage(url);
      if (res.ok) imgs.push(res.img);
      else imgs.push(makeFallbackSvg(FRUIT_LEVELS[i].r, i));
    }
    return imgs;
  }

  let fruitImgs = [];

  /* =========================================================
     5) GAME STATE / ENTITIES
  ========================================================= */
  class Ball {
    constructor(x, y, type) {
      this.x = x;
      this.y = y;
      this.type = type;
      this.r = FRUIT_LEVELS[type].r;

      this.vx = (Math.random() - 0.5) * 0.8;
      this.vy = 0;

      this.angle = Math.random() * Math.PI * 2;
      this.av = (Math.random() - 0.5) * 0.02;

      this.m = this.r * this.r;
      this.mergeLock = 14;

      this.overFrames = 0;
      this.seenBelowDead = false;
    }
  }

  const balls = [];
  let score = 0;
  let gameState = 'ready'; // ready | playing | over
  let lastMoveAt = 0;

  let nextType = 0;
  function rollNext() {
    nextType = Math.floor(Math.random() * 5); // 난이도 상향: 0~4단계
  }
  rollNext();

  let aimX = null;
  let dropCooldown = 0;

  function resetGame() {
    balls.length = 0;
    score = 0;
    scoreEl.textContent = '0';
    dropCooldown = 0;
    rollNext();

    const b = bucketRect();
    aimX = (b.left + b.right) / 2;

    gameOverEl.style.display = 'none';
    overlay.style.display = 'flex';
    gameState = 'ready';
  }

  function startGame() {
    overlay.style.display = 'none';
    gameOverEl.style.display = 'none';
    gameState = 'playing';
  }

  function setGameOver() {
    if (gameState !== 'playing') return;
    gameState = 'over';
    audio.play('over');
    gameOverEl.style.display = 'flex';
  }

  function restartGame() {
    balls.length = 0;
    score = 0;
    scoreEl.textContent = '0';
    dropCooldown = 0;
    rollNext();
    startGame();
  }

  /* =========================================================
     6) INPUT
  ========================================================= */
  function clampAimX(x) {
    const b = bucketRect();
    const r = FRUIT_LEVELS[nextType].r;
    return clamp(x, b.left + r + 8, b.right - r - 8);
  }

  function addBallAt(x) {
    const spawnY = deadY() + GAME.spawnBelowDeadPx;
    const ball = new Ball(x, spawnY, nextType);
    ball.seenBelowDead = true;

    balls.push(ball);
    rollNext();

    audio.play('drop');
    vib(8);
    dropCooldown = GAME.dropCooldownFrames;
  }

  btnStart.addEventListener('click', () => {
    audio.unlock();
    if (gameState === 'ready') startGame();
    else if (gameState === 'over') restartGame();
  });

  btnRestart.addEventListener('click', () => {
    audio.unlock();
    restartGame();
  });

  function localX(clientX) {
    return clientX - canvas.getBoundingClientRect().left;
  }

  document.addEventListener('mousemove', (e) => {
    aimX = clampAimX(localX(e.clientX));
    if (gameState === 'playing') {
      const now = performance.now();
      if (now - lastMoveAt >= 100) {
        lastMoveAt = now;
        audio.play('move');
      }
    }
  });

  document.addEventListener('mousedown', (e) => {
    audio.unlock();

    if (gameState === 'ready') {
      startGame();
      return;
    }
    if (gameState === 'over') {
      restartGame();
      return;
    }
    if (gameState === 'playing') {
      aimX = clampAimX(localX(e.clientX));
      if (dropCooldown <= 0) addBallAt(aimX);
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.code !== 'Space') return;
    e.preventDefault();
    audio.unlock();

    if (gameState === 'ready') {
      startGame();
      return;
    }
    if (gameState === 'over') {
      restartGame();
      return;
    }
    if (gameState === 'playing') {
      const b = bucketRect();
      const x = aimX ?? (b.left + b.right) / 2;
      if (dropCooldown <= 0) addBallAt(clampAimX(x));
    }
  });

  /* =========================================================
     7) PHYSICS (벽/바닥/공-공)
  ========================================================= */
  function collideWithCircle(ball, cx, cy, cr, restitution) {
    const dx = ball.x - cx;
    const dy = ball.y - cy;
    const dist = Math.hypot(dx, dy);
    const minD = ball.r + cr;
    if (dist === 0 || dist >= minD) return false;

    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minD - dist;

    ball.x += nx * overlap;
    ball.y += ny * overlap;

    const vn = ball.vx * nx + ball.vy * ny;
    if (vn < 0) {
      ball.vx -= (1 + restitution) * vn * nx;
      ball.vy -= (1 + restitution) * vn * ny;
      ball.vx *= 0.98;
      ball.vy *= 0.98;
      ball.av *= 0.98;
      vib(6);
    }
    return true;
  }

  function resolveBucket(ball) {
    const b = bucketRect();

    const wallTop = b.top;
    const wallBottom = b.bottom - b.radius;

    if (ball.y > wallTop && ball.y < wallBottom) {
      if (ball.x - ball.r < b.left) {
        ball.x = b.left + ball.r;
        if (ball.vx < 0) { ball.vx = -ball.vx * PHYS.wallRest; }
      }
      if (ball.x + ball.r > b.right) {
        ball.x = b.right - ball.r;
        if (ball.vx > 0) { ball.vx = -ball.vx * PHYS.wallRest; }
      }
    }

    const floorY = b.bottom;
    const floorLeft = b.left + b.radius;
    const floorRight = b.right - b.radius;

    if (ball.x > floorLeft && ball.x < floorRight) {
      if (ball.y + ball.r > floorY) {
        ball.y = floorY - ball.r;
        if (ball.vy > 0) ball.vy = -ball.vy * PHYS.floorRest;
        ball.vx *= PHYS.friction;
        ball.av *= PHYS.friction;
      }
    }

    const lcX = b.left + b.radius;
    const lcY = b.bottom - b.radius;
    const rcX = b.right - b.radius;
    const rcY = b.bottom - b.radius;

    collideWithCircle(ball, lcX, lcY, b.radius, 0.25);
    collideWithCircle(ball, rcX, rcY, b.radius, 0.25);
  }

  function resolveBallBall(a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    const minD = a.r + b.r;
    if (dist === 0 || dist >= minD) return false;

    const nx = dx / dist;
    const ny = dy / dist;

    const overlap = minD - dist;
    const total = a.m + b.m;
    const moveA = overlap * (b.m / total);
    const moveB = overlap * (a.m / total);

    a.x -= nx * moveA;
    a.y -= ny * moveA;
    b.x += nx * moveB;
    b.y += ny * moveB;

    const rvx = b.vx - a.vx;
    const rvy = b.vy - a.vy;
    const rel = rvx * nx + rvy * ny;
    if (rel > 0) return true;

    const e = PHYS.ballRest;
    const j = (-(1 + e) * rel) / (1 / a.m + 1 / b.m);

    const ix = j * nx;
    const iy = j * ny;

    a.vx -= ix / a.m;
    a.vy -= iy / a.m;
    b.vx += ix / b.m;
    b.vy += iy / b.m;

    return true;
  }

  /* =========================================================
     8) MERGE (3개 합체)
     - 핵심: 접촉(dist <= r+r + padding)도 “붙음”으로 인정
  ========================================================= */
  function isTouching(a, b, padPx) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dist = Math.hypot(dx, dy);
    return dist <= (a.r + b.r + padPx);
  }

  function mergeTriples() {
    if (balls.length < GAME.mergeCount) return;

    // 타입별로 후보 모으기
    const byType = new Map();
    for (let i = 0; i < balls.length; i++) {
      const ball = balls[i];
      if (ball.mergeLock > 0) continue;
      if (ball.type >= FRUIT_LEVELS.length - 1) continue;
      const arr = byType.get(ball.type) || [];
      arr.push({ ball, idx: i });
      byType.set(ball.type, arr);
    }

    // 각 타입에서 “붙어있는 그룹”을 찾아 3개 이상이면 합체
    for (const [type, arr] of byType.entries()) {
      if (arr.length < GAME.mergeCount) continue;

      const used = new Set();

      // 간단한 그리디: 아직 안쓴 공 하나 잡고, 거기 붙어있는 공들 모아서 3개면 합체
      for (let a = 0; a < arr.length; a++) {
        if (used.has(arr[a].idx)) continue;

        const group = [arr[a]];
        for (let b = 0; b < arr.length; b++) {
          if (a === b) continue;
          if (used.has(arr[b].idx)) continue;
          if (isTouching(arr[a].ball, arr[b].ball, GAME.mergeTouchPaddingPx)) {
            group.push(arr[b]);
            if (group.length >= GAME.mergeCount) break;
          }
        }

        if (group.length >= GAME.mergeCount) {
          // 합체 실행 (그룹 중 3개만)
          const pick = group.slice(0, GAME.mergeCount);

          // 중심점/속도 평균
          let cx = 0, cy = 0, vx = 0, vy = 0, av = 0;
          for (const it of pick) {
            cx += it.ball.x; cy += it.ball.y;
            vx += it.ball.vx; vy += it.ball.vy;
            av += it.ball.av;
          }
          cx /= pick.length; cy /= pick.length;
          vx /= pick.length; vy /= pick.length;
          av /= pick.length;

          // 인덱스 큰 것부터 삭제(안전)
          pick.sort((p1, p2) => p2.idx - p1.idx);
          for (const it of pick) {
            used.add(it.idx);
            balls.splice(it.idx, 1);
          }

          // 다음 단계 공 생성
          const nb = new Ball(cx, cy, type + 1);
          nb.vx = vx;
          nb.vy = vy;
          nb.av = av;
          nb.mergeLock = GAME.mergeLockFrames;
          nb.seenBelowDead = true;

          balls.push(nb);

          score += Math.round((type + 1) / 2); // 기존 (type+1)*25 의 1/50
          if (nb.type === FRUIT_LEVELS.length - 1) score += 100; // 수박 보너스
          scoreEl.textContent = String(score);
          updateEndBadge();

          audio.play('merge');
          vibMerge();

          // 1프레임에 다중 합체가 너무 과해지는 걸 방지: 타입당 1회만
          return;
        }
      }
    }
  }

  /* =========================================================
     9) GAME OVER CHECK
  ========================================================= */
  function checkGameOver() {
    if (balls.length === 0) return;

    const dy = deadY();
    for (const ball of balls) {
      if (!ball.seenBelowDead) {
        if (ball.y - ball.r > dy + 2) ball.seenBelowDead = true;
        continue;
      }
      const isAbove = (ball.y - ball.r) < dy;
      if (isAbove) ball.overFrames++;
      else ball.overFrames = 0;

      if (ball.overFrames >= GAME.deadFrames) {
        setGameOver();
        return;
      }
    }
  }

  /* =========================================================
     10) RENDER
  ========================================================= */
  function drawBackground() {
    ctx.fillStyle = '#f6e1b6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawBucket() {
    const b = bucketRect();

    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(b.left - 4, b.top - 2, b.right - b.left + 8, b.bottom - b.top + 10);

    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.moveTo(b.left, b.top);
    ctx.lineTo(b.left, b.bottom - b.radius);
    ctx.arc(b.left + b.radius, b.bottom - b.radius, b.radius, Math.PI, Math.PI / 2, true);
    ctx.lineTo(b.right - b.radius, b.bottom);
    ctx.arc(b.right - b.radius, b.bottom - b.radius, b.radius, Math.PI / 2, 0, true);
    ctx.lineTo(b.right, b.top);
    ctx.stroke();

    // 데드라인
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 10]);
    ctx.strokeStyle = 'rgba(255,0,0,0.18)';
    ctx.beginPath();
    ctx.moveTo(b.left + 10, deadY());
    ctx.lineTo(b.right - 10, deadY());
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawAim() {
    if (gameState !== 'playing') return;

    const b = bucketRect();
    const x = aimX ?? (b.left + b.right) / 2;

    ctx.lineWidth = 2;
    ctx.setLineDash([6, 10]);
    ctx.strokeStyle = 'rgba(0,0,0,0.20)';
    ctx.beginPath();
    ctx.moveTo(x, b.top + 8);
    ctx.lineTo(x, b.bottom - 8);
    ctx.stroke();
    ctx.setLineDash([]);

    const r = FRUIT_LEVELS[nextType].r;
    ctx.globalAlpha = 0.85;
    ctx.drawImage(fruitImgs[nextType], x - r, b.top + 10, r * 2, r * 2);
    ctx.globalAlpha = 1;
  }

  function drawBall(ball) {
    const img = fruitImgs[ball.type];
    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.rotate(ball.angle);
    ctx.drawImage(img, -ball.r, -ball.r, ball.r * 2, ball.r * 2);
    ctx.restore();
  }

  /* =========================================================
     11) LOOP
  ========================================================= */
  function step() {
    if (gameState !== 'playing') return;

    if (dropCooldown > 0) dropCooldown--;

    for (const ball of balls) {
      if (ball.mergeLock > 0) ball.mergeLock--;

      ball.vy += PHYS.g;

      ball.vx *= PHYS.air;
      ball.vy *= PHYS.air;

      ball.vx = clamp(ball.vx, -GAME.maxSpeed, GAME.maxSpeed);
      ball.vy = clamp(ball.vy, -GAME.maxSpeed, GAME.maxSpeed);

      ball.x += ball.vx;
      ball.y += ball.vy;

      ball.angle += ball.av + ball.vx * 0.002;
      ball.av *= 0.995;

      resolveBucket(ball);
    }

    for (let it = 0; it < GAME.physicsIterations; it++) {
      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          resolveBallBall(balls[i], balls[j]);
        }
      }
    }

    // 3개 합체
    mergeTriples();

    checkGameOver();

  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawBackground();
    drawBucket();
    drawAim();
    for (const ball of balls) drawBall(ball);

    step();
    requestAnimationFrame(render);
  }

  /* =========================================================
     12) BOOT
  ========================================================= */
  async function boot() {
    fruitImgs = await loadFruitImages();
    resetGame();
    render();
  }

  /* =========================================================
     END BUTTON (온체인 점수 저장)
  ========================================================= */
  let endBadgeEl = null;

  function updateEndBadge() {
    if (endBadgeEl) endBadgeEl.textContent = String(score);
  }

  function getReturnUrl() {
    const p = new URLSearchParams(location.search);
    const ret = p.get('return');
    if (ret) { try { return decodeURIComponent(ret); } catch { return ret; } }
    return '../offchain.html';
  }

  function setupEndButton() {
    const style = document.createElement('style');
    style.textContent = `
      .suika-end {
        position: absolute;
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
      .suika-end .badge {
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

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'suika-end';
    btn.innerHTML = '<span>END</span><span class="badge" id="suikaEndBadge">0</span>';
    wrap.appendChild(btn);

    endBadgeEl = btn.querySelector('#suikaEndBadge');
    updateEndBadge();

    btn.addEventListener('click', async () => {
      const finalScore = Number(score || 0);
      const qs     = new URLSearchParams(location.search);
      const gameId = qs.get('game') || 'suika';
      const nonce  = qs.get('nonce') || '';

      if (!nonce) {
        alert('nonce 없음: offchain에서 joinGame부터 하세요.');
        return;
      }

      const address = window.ethereum?.selectedAddress;
      if (!address) {
        alert('지갑 주소 없음: Rabby/MetaMask 연결을 확인하세요.');
        return;
      }
      if (!window.ethereum?.request) {
        alert('지갑 provider가 없습니다.');
        return;
      }

      const payload = `PAW_OFFCHAIN|${gameId}|${address}|${nonce}|${finalScore}`;

      let sig = '';
      try {
        sig = await window.ethereum.request({
          method: 'personal_sign',
          params: [payload, address],
        });
      } catch (_e) {
        alert('서명이 취소되었습니다.');
        return;
      }

      localStorage.setItem('paw_score_suika',   String(finalScore));
      localStorage.setItem('paw_sig_suika',      sig);
      localStorage.setItem('paw_payload_suika',  payload);

      const ret = getReturnUrl();
      const url = new URL(ret, location.href);
      url.searchParams.set('game',    gameId);
      url.searchParams.set('score',   String(finalScore));
      url.searchParams.set('sig',     sig);
      url.searchParams.set('payload', payload);

      location.href = url.toString();
    });
  }

  setupEndButton();
  boot();
})();