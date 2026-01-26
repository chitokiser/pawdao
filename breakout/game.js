// /breakout/game.js
(() => {
  const cv = document.getElementById("cv");
  const ctx = cv.getContext("2d");

  const $score = document.getElementById("score");
  const $lives = document.getElementById("lives");
  const $level = document.getElementById("level");

  const overlay = document.getElementById("overlay");
  const ovTitle = document.getElementById("ovTitle");
  const ovDesc = document.getElementById("ovDesc");
  const btnStart = document.getElementById("btnStart");
  const btnReset = document.getElementById("btnReset");

  const W = cv.width;
  const H = cv.height;

  // ---- score rules ----
  const BRICK_SCORE = 5;
  const BASE_LIVES = 3;
  const BASE_BALL_SPEED = 380; // px/s
  const SPEED_UP_PER_LEVEL = 1.10;

  // ---- minimal SFX (WebAudio) ----
  const SFX = (() => {
    let ctxA = null;
    let master = null;

    function ensure(){
      if (ctxA) return;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      ctxA = new AudioCtx();
      master = ctxA.createGain();
      master.gain.value = 0.10;
      master.connect(ctxA.destination);
    }

    async function unlock(){
      try{
        ensure();
        if (!ctxA) return;
        if (ctxA.state === "suspended") await ctxA.resume();
      }catch(_e){}
    }

    function beep(freq, dur=0.06, type="triangle", vol=1){
      if (state.muted) return;
      ensure();
      if (!ctxA || !master) return;
      const o = ctxA.createOscillator();
      const g = ctxA.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, ctxA.currentTime);
      g.gain.setValueAtTime(0.0001, ctxA.currentTime);
      g.gain.exponentialRampToValueAtTime(0.12 * vol, ctxA.currentTime + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, ctxA.currentTime + dur);
      o.connect(g);
      g.connect(master);
      o.start(ctxA.currentTime);
      o.stop(ctxA.currentTime + dur + 0.01);
    }

    return {
      unlock,
      paddle(){ beep(220, 0.03, "square", 0.5); },
      wall(){ beep(320, 0.04, "triangle", 0.6); },
      brick(){ beep(520, 0.06, "triangle", 0.85); },
      lose(){ [330, 262, 196].forEach((f,i)=>setTimeout(()=>beep(f,0.12,"sawtooth",0.9), i*90)); },
      win(){ [523, 659, 784].forEach((f,i)=>setTimeout(()=>beep(f,0.10,"triangle",0.9), i*85)); },
      start(){ [523,659].forEach((f,i)=>setTimeout(()=>beep(f,0.10,"triangle",0.85), i*70)); },
      muteToggle(on){ if (on) beep(120, 0.10, "sine", 1); else beep(650, 0.08, "triangle", 1); }
    };
  })();

  function qs(){
    try { return new URLSearchParams(location.search); }
    catch { return new URLSearchParams(); }
  }
  function getReturnUrl(){
    const p = qs();
    const ret = p.get("return");
    if (ret) {
      try { return decodeURIComponent(ret); } catch { return ret; }
    }
    return "../offchain.html";
  }
  function getNonceFromQuery(){
    return qs().get("nonce") || "";
  }

  function clamp(v, a, b){
    return Math.max(a, Math.min(b, v));
  }

  const state = {
    running: false,
    paused: false,
    over: false,
    muted: false,

    score: 0,
    lives: BASE_LIVES,
    level: 1,

    // paddle
    px: W/2,
    pw: 130,
    ph: 14,
    py: H - 34,
    pSpeed: 720,

    // ball
    bx: W/2,
    by: H - 60,
    br: 7,
    bvx: 220,
    bvy: -420,
    bSpeed: BASE_BALL_SPEED,
    launched: false,

    // bricks
    rows: 6,
    cols: 10,
    brickW: 0,
    brickH: 20,
    brickGap: 8,
    topOffset: 62,
    leftOffset: 26,
    bricks: [],

    lastT: 0,
  };

  function makeBricks(){
    const usableW = W - state.leftOffset*2;
    state.brickW = Math.floor((usableW - (state.cols-1)*state.brickGap) / state.cols);
    state.bricks = [];
    for(let r=0;r<state.rows;r++){
      for(let c=0;c<state.cols;c++){
        state.bricks.push({
          r, c,
          x: state.leftOffset + c*(state.brickW + state.brickGap),
          y: state.topOffset + r*(state.brickH + state.brickGap),
          w: state.brickW,
          h: state.brickH,
          alive: true,
        });
      }
    }
  }

  function resetBall(){
    state.bx = state.px;
    state.by = state.py - 18;
    state.launched = false;

    // 방향은 매번 약간 랜덤
    const dir = Math.random() < 0.5 ? -1 : 1;
    state.bSpeed = BASE_BALL_SPEED * Math.pow(SPEED_UP_PER_LEVEL, state.level-1);
    const angle = (Math.random()*0.5 + 0.25) * Math.PI; // 45~135도
    state.bvx = Math.cos(angle) * state.bSpeed * dir;
    state.bvy = -Math.abs(Math.sin(angle) * state.bSpeed);
  }

  function resetAll(){
    state.running = false;
    state.paused = false;
    state.over = false;

    state.score = 0;
    state.lives = BASE_LIVES;
    state.level = 1;

    state.px = W/2;
    makeBricks();
    resetBall();

    hud();
    showOverlay(true, "READY", "Space: 시작 / P: 일시정지 / M: 음소거");
  }

  function hud(){
    $score.textContent = String(state.score);
    $lives.textContent = String(state.lives);
    $level.textContent = String(state.level);
    if (endUI.badge) endUI.badge.textContent = String(state.score);
  }

  function showOverlay(on, title, desc){
    if(on){
      overlay.classList.remove("hidden");
      ovTitle.textContent = title;
      ovDesc.textContent = desc || "";
    }else{
      overlay.classList.add("hidden");
    }
  }

  function rectHitCircle(rx, ry, rw, rh, cx, cy, cr){
    const nx = clamp(cx, rx, rx + rw);
    const ny = clamp(cy, ry, ry + rh);
    const dx = cx - nx;
    const dy = cy - ny;
    return (dx*dx + dy*dy) <= cr*cr;
  }

  function step(dt){
    // paddle move
    let dir = 0;
    if (keys.left) dir -= 1;
    if (keys.right) dir += 1;
    if (dir !== 0) {
      state.px += dir * state.pSpeed * dt;
      state.px = clamp(state.px, state.pw/2 + 8, W - state.pw/2 - 8);
    }

    if(!state.launched){
      state.bx = state.px;
      state.by = state.py - 18;
      return;
    }

    // move ball
    state.bx += state.bvx * dt;
    state.by += state.bvy * dt;

    // walls
    if (state.bx - state.br < 0){
      state.bx = state.br;
      state.bvx *= -1;
      SFX.wall();
    } else if (state.bx + state.br > W){
      state.bx = W - state.br;
      state.bvx *= -1;
      SFX.wall();
    }

    if (state.by - state.br < 0){
      state.by = state.br;
      state.bvy *= -1;
      SFX.wall();
    }

    // bottom
    if (state.by - state.br > H){
      state.lives -= 1;
      SFX.lose();
      hud();
      if (state.lives <= 0){
        state.running = false;
        state.over = true;
        showOverlay(true, "GAME OVER", "Space: 다시 시작 / R: 리셋");
        return;
      }
      resetBall();
      return;
    }

    // paddle collision
    const paddleRect = {
      x: state.px - state.pw/2,
      y: state.py,
      w: state.pw,
      h: state.ph,
    };

    if (state.bvy > 0 && rectHitCircle(paddleRect.x, paddleRect.y, paddleRect.w, paddleRect.h, state.bx, state.by, state.br)){
      // reflect
      const hitPos = (state.bx - state.px) / (state.pw/2);
      const angle = clamp(hitPos, -1, 1) * (Math.PI * 0.35); // -63~63 deg
      const speed = Math.max(240, Math.hypot(state.bvx, state.bvy));
      state.bvx = Math.sin(angle) * speed * 1.15;
      state.bvy = -Math.cos(angle) * speed;
      state.by = paddleRect.y - state.br - 0.5;
      SFX.paddle();
    }

    // brick collisions
    let hitAny = false;
    for(const b of state.bricks){
      if(!b.alive) continue;
      if(rectHitCircle(b.x, b.y, b.w, b.h, state.bx, state.by, state.br)){
        b.alive = false;
        hitAny = true;
        state.score += BRICK_SCORE;
        // bounce: choose axis by penetration
        const cx = clamp(state.bx, b.x, b.x + b.w);
        const cy = clamp(state.by, b.y, b.y + b.h);
        const dx = state.bx - cx;
        const dy = state.by - cy;
        if (Math.abs(dx) > Math.abs(dy)) state.bvx *= -1;
        else state.bvy *= -1;
        SFX.brick();
        hud();
        break;
      }
    }

    if(hitAny){
      const remaining = state.bricks.some(b => b.alive);
      if(!remaining){
        state.level += 1;
        SFX.win();
        makeBricks();
        resetBall();
        hud();
        showOverlay(true, "CLEAR", "Space: 다음 레벨 시작 / R: 리셋");
      }
    }
  }

  function draw(){
    // background
    ctx.clearRect(0,0,W,H);
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0, "rgba(255,255,255,.06)");
    g.addColorStop(1, "rgba(0,0,0,.28)");
    ctx.fillStyle = g;
    ctx.fillRect(0,0,W,H);

    // bricks
    for(const b of state.bricks){
      if(!b.alive) continue;
      const hue = 160 + b.r*12;
      ctx.fillStyle = `hsla(${hue}, 85%, 58%, .92)`;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = "rgba(0,0,0,.25)";
      ctx.strokeRect(b.x+0.5, b.y+0.5, b.w-1, b.h-1);
      ctx.strokeStyle = "rgba(255,255,255,.18)";
      ctx.strokeRect(b.x+2.5, b.y+2.5, b.w-5, b.h-5);
    }

    // paddle
    ctx.fillStyle = "rgba(255,255,255,.9)";
    ctx.fillRect(state.px - state.pw/2, state.py, state.pw, state.ph);
    ctx.fillStyle = "rgba(0,0,0,.18)";
    ctx.fillRect(state.px - state.pw/2, state.py, state.pw, 2);

    // ball
    ctx.beginPath();
    ctx.arc(state.bx, state.by, state.br, 0, Math.PI*2);
    ctx.fillStyle = "rgba(255,209,102,.95)";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.25)";
    ctx.stroke();
  }

  function loop(t){
    if(!state.lastT) state.lastT = t;
    const dt = Math.min(0.03, (t - state.lastT) / 1000);
    state.lastT = t;

    if(state.running && !state.paused && !state.over){
      step(dt);
    }
    draw();
    requestAnimationFrame(loop);
  }

  function startGame(){
    if(state.over){
      resetAll();
    }
    if(!state.running){
      state.running = true;
      state.paused = false;
      state.over = false;
      showOverlay(false);
      SFX.start();
      return;
    }
    if(state.paused) togglePause();
  }

  function togglePause(){
    if(!state.running || state.over) return;
    state.paused = !state.paused;
    showOverlay(state.paused, "PAUSED", "P: 재개 / M: 음소거");
  }

  function launch(){
    if(!state.running || state.paused || state.over) return;
    if(!state.launched){
      state.launched = true;
    }
  }

  const keys = { left:false, right:false };

  function preventScrollKey(k){
    return k === " " || k === "ArrowLeft" || k === "ArrowRight";
  }

  window.addEventListener("keydown", async (e) => {
    const k = e.key;
    if(preventScrollKey(k)) e.preventDefault();
    await SFX.unlock();

    if(k === "m" || k === "M"){
      state.muted = !state.muted;
      SFX.muteToggle(state.muted);
      return;
    }
    if(k === "p" || k === "P"){
      togglePause();
      return;
    }
    if(k === "r" || k === "R"){
      resetAll();
      return;
    }

    if(k === " "){
      if(!state.running || state.over) startGame();
      else launch();
      return;
    }

    if(k === "ArrowLeft") keys.left = true;
    if(k === "ArrowRight") keys.right = true;
  });

  window.addEventListener("keyup", (e) => {
    if(e.key === "ArrowLeft") keys.left = false;
    if(e.key === "ArrowRight") keys.right = false;
  });

  btnStart.addEventListener("click", async () => { await SFX.unlock(); startGame(); });
  btnReset.addEventListener("click", async () => { await SFX.unlock(); resetAll(); });

  // ---- END button (sign + return to offchain) ----
  const endUI = { btn: null, badge: null };

  function setupEndButton(){
    const style = document.createElement("style");
    style.textContent = `
      .breakout-end{
        position: fixed;
        right: 14px;
        bottom: 14px;
        z-index: 9999;
        display: inline-flex;
        align-items: center;
        gap: 10px;
        padding: 10px 12px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,.18);
        background: rgba(0,0,0,.45);
        color: #eaf1ff;
        cursor: pointer;
        user-select: none;
        backdrop-filter: blur(6px);
      }
      .breakout-end .badge{
        display:inline-flex;
        align-items:center;
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,.14);
        background: rgba(255,255,255,.06);
        font-weight: 900;
      }
    `;
    document.head.appendChild(style);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "breakout-end";
    btn.innerHTML = `<span>END</span><span class="badge" id="brEndBadge">0</span>`;
    document.body.appendChild(btn);

    endUI.btn = btn;
    endUI.badge = btn.querySelector("#brEndBadge");
    hud();

    btn.addEventListener("click", async () => {
      await SFX.unlock();

      const score = Number(state.score || 0);
      const nonce = getNonceFromQuery();
      const address = window.ethereum?.selectedAddress;

      if(!nonce){
        alert("nonce 없음: offchain에서 게임 시작(joinGame)부터 하세요.");
        return;
      }
      if(!address){
        alert("지갑 주소 없음: Rabby/MetaMask 연결을 확인하세요.");
        return;
      }
      if(!window.ethereum?.request){
        alert("지갑 provider가 없습니다.");
        return;
      }

      const payload = `PAW_OFFCHAIN|breakout|${address}|${nonce}|${score}`;

      let sig = "";
      try{
        sig = await window.ethereum.request({
          method: "personal_sign",
          params: [payload, address],
        });
      }catch(_e){
        alert("서명이 취소되었습니다.");
        return;
      }

      const ret = getReturnUrl();
      const url = new URL(ret, location.href);
      url.searchParams.set("game", "breakout");
      url.searchParams.set("score", String(score));
      url.searchParams.set("sig", String(sig));
      url.searchParams.set("payload", String(payload));

      location.href = url.toString();
    });
  }

  // init
  makeBricks();
  resetAll();
  setupEndButton();
  requestAnimationFrame(loop);
})();
