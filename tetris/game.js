// /tetris/game.js
(() => {
  const COLS = 10;
  const ROWS = 20;
  const CELL = 30;

  const boardCanvas = document.getElementById("board");
  const ctx = boardCanvas.getContext("2d");

  const nextCanvas = document.getElementById("next");
  const nextCtx = nextCanvas.getContext("2d");

  const holdCanvas = document.getElementById("hold");
  const holdCtx = holdCanvas.getContext("2d");

  const $score = document.getElementById("score");
  const $lines = document.getElementById("lines");
  const $level = document.getElementById("level");

  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayDesc = document.getElementById("overlayDesc");
  const btnStart = document.getElementById("btnStart");
  const btnReset = document.getElementById("btnReset");

  boardCanvas.width = COLS * CELL;
  boardCanvas.height = ROWS * CELL;

  const COLORS = {
    I: "#00e5ff",
    O: "#ffd166",
    T: "#c77dff",
    S: "#2ee59d",
    Z: "#ff4d6d",
    J: "#4dabff",
    L: "#ff9f1c",
    G: "rgba(255,255,255,.18)",
    X: "rgba(255,255,255,.06)",
  };

  const SHAPES = {
    I: [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]],
    O: [[0,1,1,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],
    T: [[0,1,0,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]],
    S: [[0,1,1,0],[1,1,0,0],[0,0,0,0],[0,0,0,0]],
    Z: [[1,1,0,0],[0,1,1,0],[0,0,0,0],[0,0,0,0]],
    J: [[1,0,0,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]],
    L: [[0,0,1,0],[1,1,1,0],[0,0,0,0],[0,0,0,0]],
  };

  function shuffle(a){
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function makeBag(){ return shuffle(["I","O","T","S","Z","J","L"]); }

  function createMatrix(r,c,fill=0){
    const m=[]; for(let i=0;i<r;i++) m.push(new Array(c).fill(fill));
    return m;
  }
  function cloneMatrix(m){ return m.map(row=>row.slice()); }

  function rotateCW(mat){
    const N = mat.length;
    const out = createMatrix(N, N, 0);
    for(let r=0;r<N;r++) for(let c=0;c<N;c++) out[c][N-1-r] = mat[r][c];
    return out;
  }
  function rotateCCW(mat){ return rotateCW(rotateCW(rotateCW(mat))); }

  function forEachCell(piece, fn){
    const m = piece.mat;
    for(let r=0;r<m.length;r++){
      for(let c=0;c<m[r].length;c++){
        if(m[r][c]) fn(piece.x + c, piece.y + r);
      }
    }
  }

  function collides(board, piece){
    let hit = false;
    forEachCell(piece, (x,y)=>{
      if (x < 0 || x >= COLS || y >= ROWS) { hit = true; return; }
      if (y >= 0 && board[y][x]) { hit = true; return; }
    });
    return hit;
  }

  function merge(board, piece){
    forEachCell(piece, (x,y)=>{
      if (y >= 0 && y < ROWS && x >= 0 && x < COLS){
        board[y][x] = piece.type;
      }
    });
  }

  function clearLines(board){
    let cleared = 0;
    for(let r=ROWS-1; r>=0; r--){
      if (board[r].every(v => v !== 0)){
        board.splice(r,1);
        board.unshift(new Array(COLS).fill(0));
        cleared++;
        r++;
      }
    }
    return cleared;
  }

  function tryRotate(board, piece, dir){
    const next = {
      ...piece,
      mat: dir === "CW" ? rotateCW(piece.mat) : rotateCCW(piece.mat),
    };
    const kicks = [0, -1, 1, -2, 2];
    for(const dx of kicks){
      const cand = { ...next, x: piece.x + dx, y: piece.y };
      if (!collides(board, cand)){
        piece.mat = cand.mat;
        piece.x = cand.x;
        return true;
      }
    }
    return false;
  }

  function newPiece(type){
    return { type, mat: cloneMatrix(SHAPES[type]), x: Math.floor((COLS - 4)/2), y: -1 };
  }

  function calcGhost(board, piece){
    const g = { ...piece, mat: piece.mat, x: piece.x, y: piece.y };
    while(!collides(board, { ...g, y: g.y + 1 })) g.y++;
    return g;
  }

  // Sound (WebAudio 간단)
  const SFX = (() => {
    let ctxA = null;
    let master = null;

    function ensure(){
      if (ctxA) return;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      ctxA = new AudioCtx();
      master = ctxA.createGain();
      master.gain.value = 0.12;
      master.connect(ctxA.destination);
    }

    async function unlock(){
      try{
        ensure();
        if (!ctxA) return;
        if (ctxA.state === "suspended") await ctxA.resume();
      }catch(_e){}
    }

    function tone(freq, dur=0.05, type="sine", vol=1){
      if (state.muted) return;
      ensure();
      if (!ctxA || !master) return;

      const o = ctxA.createOscillator();
      const g = ctxA.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, ctxA.currentTime);

      g.gain.setValueAtTime(0.0001, ctxA.currentTime);
      g.gain.exponentialRampToValueAtTime(0.12 * vol, ctxA.currentTime + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, ctxA.currentTime + dur);

      o.connect(g);
      g.connect(master);

      o.start(ctxA.currentTime);
      o.stop(ctxA.currentTime + dur + 0.01);
    }

    function chord(freqs, dur=0.08, type="triangle", vol=1){
      freqs.forEach((f, i) => setTimeout(() => tone(f, dur, type, vol), i*8));
    }

    return {
      unlock,
      move(){ tone(220, 0.03, "square", 0.55); },
      rotate(){ tone(330, 0.04, "triangle", 0.65); },
      soft(){ tone(180, 0.02, "square", 0.35); },
      hard(){ chord([440, 660], 0.06, "triangle", 0.85); },
      lock(){ tone(140, 0.05, "sawtooth", 0.6); },
      clear(lines){
        if(lines === 1) chord([440, 550], 0.07, "triangle", 0.9);
        else if(lines === 2) chord([440, 660, 880], 0.08, "triangle", 0.95);
        else if(lines === 3) chord([392, 523, 659, 988], 0.09, "triangle", 1.0);
        else chord([330, 440, 660, 880, 1100], 0.10, "triangle", 1.1);
      },
      hold(){ chord([262, 330], 0.06, "sine", 0.7); },
      over(){ [392, 330, 262, 196].forEach((f,i)=>setTimeout(()=>tone(f,0.12,"sawtooth",0.9), i*90)); },
      start(){ chord([523, 659], 0.09, "triangle", 0.9); },
      pause(){ tone(200, 0.06, "sine", 0.8); },
      resume(){ tone(260, 0.06, "sine", 0.8); },
      muteToggle(on){ if (on) tone(120, 0.09, "sine", 1.0); else tone(520, 0.08, "triangle", 1.0); }
    };
  })();

  // 점수는 기존의 1/10 단위
  const LINE_SCORE = [0, 10, 30, 50, 80];

  // 점수 100마다 속도 20% 증가 => dropInterval 20% 감소
  const SPEED_BASE_INTERVAL = 700;
  const SPEED_MIN_INTERVAL = 60;
  const SPEED_STEP_SCORE = 100;
  const SPEED_MULT = 0.8;

  const state = {
    board: createMatrix(ROWS, COLS, 0),
    bag: makeBag(),
    nextType: null,
    cur: null,

    holdType: null,
    holdUsed: false,

    score: 0,
    lines: 0,
    level: 1,

    running: false,
    paused: false,
    over: false,

    dropCounter: 0,
    dropInterval: SPEED_BASE_INTERVAL,
    lastTime: 0,

    muted: false,
  };

  function setOverlay(show, title, desc){
    if(show){
      overlay.classList.remove("hidden");
      overlayTitle.textContent = title;
      overlayDesc.textContent = desc || "";
    }else{
      overlay.classList.add("hidden");
    }
  }

  function takeFromBag(){
    if(state.bag.length === 0) state.bag = makeBag();
    return state.bag.shift();
  }

  function refillNextIfNeeded(){
    if(!state.nextType) state.nextType = takeFromBag();
  }

  function drawCell(c, x, y, color, alpha=1){
    if (y < 0) return;
    c.save();
    c.globalAlpha = alpha;
    c.fillStyle = color;
    c.fillRect(x*CELL, y*CELL, CELL, CELL);
    c.globalAlpha = Math.min(alpha, 0.9);
    c.strokeStyle = "rgba(0,0,0,.35)";
    c.lineWidth = 2;
    c.strokeRect(x*CELL+1, y*CELL+1, CELL-2, CELL-2);
    c.globalAlpha = Math.min(alpha, 0.8);
    c.strokeStyle = "rgba(255,255,255,.18)";
    c.lineWidth = 2;
    c.strokeRect(x*CELL+2.5, y*CELL+2.5, CELL-5, CELL-5);
    c.restore();
  }

  function clearCanvas(c, w, h){ c.clearRect(0,0,w,h); }

  function drawGrid(){
    ctx.save();
    ctx.lineWidth = 1;
    ctx.strokeStyle = COLORS.X;
    for(let x=1; x<COLS; x++){
      ctx.beginPath();
      ctx.moveTo(x*CELL + 0.5, 0);
      ctx.lineTo(x*CELL + 0.5, ROWS*CELL);
      ctx.stroke();
    }
    for(let y=1; y<ROWS; y++){
      ctx.beginPath();
      ctx.moveTo(0, y*CELL + 0.5);
      ctx.lineTo(COLS*CELL, y*CELL + 0.5);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawBoard(board){
    clearCanvas(ctx, boardCanvas.width, boardCanvas.height);

    const g = ctx.createLinearGradient(0,0,0,boardCanvas.height);
    g.addColorStop(0, "rgba(255,255,255,.04)");
    g.addColorStop(1, "rgba(0,0,0,.18)");
    ctx.fillStyle = g;
    ctx.fillRect(0,0,boardCanvas.width,boardCanvas.height);

    for(let y=0;y<ROWS;y++){
      for(let x=0;x<COLS;x++){
        const v = board[y][x];
        if (v) drawCell(ctx, x, y, COLORS[v], 1);
      }
    }
    drawGrid();
  }

  function drawPiece(c, piece, alpha=1){
    const color = COLORS[piece.type];
    forEachCell(piece, (x,y)=> drawCell(c, x, y, color, alpha));
  }

  function drawGhost(c, ghost){
    forEachCell(ghost, (x,y)=> drawCell(c, x, y, COLORS.G, 0.35));
  }

  function drawMini(c, canvas, type){
    clearCanvas(c, canvas.width, canvas.height);
    const cell = 24;
    const mat = SHAPES[type] || createMatrix(4,4,0);

    let minR=99,minC=99,maxR=-1,maxC=-1;
    for(let r=0;r<4;r++){
      for(let cc=0;cc<4;cc++){
        if(mat[r][cc]){
          minR=Math.min(minR,r);
          minC=Math.min(minC,cc);
          maxR=Math.max(maxR,r);
          maxC=Math.max(maxC,cc);
        }
      }
    }
    if(maxR<0) return;

    const bw = (maxC-minC+1)*cell;
    const bh = (maxR-minR+1)*cell;
    const ox = Math.floor((canvas.width - bw)/2);
    const oy = Math.floor((canvas.height - bh)/2);

    for(let r=0;r<4;r++){
      for(let cc=0;cc<4;cc++){
        if(mat[r][cc]){
          const x = ox + (cc-minC)*cell;
          const y = oy + (r-minR)*cell;
          c.save();
          c.fillStyle = COLORS[type];
          c.fillRect(x, y, cell, cell);
          c.strokeStyle = "rgba(0,0,0,.35)";
          c.lineWidth = 2;
          c.strokeRect(x+1, y+1, cell-2, cell-2);
          c.strokeStyle = "rgba(255,255,255,.16)";
          c.strokeRect(x+2.5, y+2.5, cell-5, cell-5);
          c.restore();
        }
      }
    }
  }

  function updateHUD(){
    $score.textContent = String(state.score);
    $lines.textContent = String(state.lines);
    $level.textContent = String(state.level);
    updateEndBadge();
  }

  function updateSpeedByScore(){
    const steps = Math.floor(state.score / SPEED_STEP_SCORE);
    const interval = Math.max(
      SPEED_MIN_INTERVAL,
      Math.floor(SPEED_BASE_INTERVAL * Math.pow(SPEED_MULT, steps))
    );
    state.dropInterval = interval;
    state.level = steps + 1;
  }

  function addScore(delta){
    if (!delta) return;
    state.score += delta;
    if (state.score < 0) state.score = 0;
    updateSpeedByScore();
    updateHUD();
  }

  function spawn(){
    refillNextIfNeeded();
    const t = state.nextType;
    state.nextType = takeFromBag();
    state.cur = newPiece(t);
    state.holdUsed = false;

    drawMini(nextCtx, nextCanvas, state.nextType);
    drawMini(holdCtx, holdCanvas, state.holdType || "");

    if (collides(state.board, state.cur)){
      state.running = false;
      state.over = true;
      setOverlay(true, "GAME OVER", "Space: 다시 시작 / R: 리셋");
      SFX.over();
    }
  }

  function resetAll(){
    state.board = createMatrix(ROWS, COLS, 0);
    state.bag = makeBag();
    state.nextType = null;
    state.cur = null;

    state.holdType = null;
    state.holdUsed = false;

    state.score = 0;
    state.lines = 0;
    state.level = 1;

    state.running = false;
    state.paused = false;
    state.over = false;

    state.dropCounter = 0;
    state.dropInterval = SPEED_BASE_INTERVAL;
    state.lastTime = 0;

    clearCanvas(nextCtx, nextCanvas.width, nextCanvas.height);
    clearCanvas(holdCtx, holdCanvas.width, holdCanvas.height);

    drawBoard(state.board);
    updateHUD();
    setOverlay(true, "READY", "Space: 시작 / P: 일시정지 / M: 음소거");
  }

  function lockPiece(){
    merge(state.board, state.cur);
    SFX.lock();

    const cleared = clearLines(state.board);
    if(cleared > 0){
      state.lines += cleared;
      addScore(LINE_SCORE[cleared]);
      SFX.clear(cleared);
    }
    spawn();
  }

  function softDrop(){
    if(!state.running || state.paused || state.over) return;
    const cand = { ...state.cur, y: state.cur.y + 1 };
    if(!collides(state.board, cand)){
      state.cur.y++;
      SFX.soft();
    }else{
      lockPiece();
    }
  }

  function hardDrop(){
    if(!state.running || state.paused || state.over) return;
    const beforeY = state.cur.y;
    const g = calcGhost(state.board, state.cur);
    state.cur.y = g.y;

    const dist = Math.max(0, state.cur.y - beforeY);
    addScore(dist);

    SFX.hard();
    lockPiece();
  }

  function move(dx){
    if(!state.running || state.paused || state.over) return;
    const cand = { ...state.cur, x: state.cur.x + dx };
    if(!collides(state.board, cand)){
      state.cur.x += dx;
      SFX.move();
    }
  }

  function rotate(dir){
    if(!state.running || state.paused || state.over) return;
    const ok = tryRotate(state.board, state.cur, dir);
    if(ok) SFX.rotate();
  }

  function hold(){
    if(!state.running || state.paused || state.over) return;
    if(state.holdUsed) return;

    const curType = state.cur.type;
    if(!state.holdType){
      state.holdType = curType;
      SFX.hold();
      spawn();
    }else{
      const tmp = state.holdType;
      state.holdType = curType;
      state.cur = newPiece(tmp);
      SFX.hold();
      if (collides(state.board, state.cur)){
        state.running = false;
        state.over = true;
        setOverlay(true, "GAME OVER", "Space: 다시 시작 / R: 리셋");
        SFX.over();
      }
    }
    state.holdUsed = true;
    drawMini(holdCtx, holdCanvas, state.holdType);
  }

  function togglePause(){
    if(!state.running || state.over) return;
    state.paused = !state.paused;
    if(state.paused){
      setOverlay(true, "PAUSED", "P: 재개 / M: 음소거");
      SFX.pause();
    }else{
      setOverlay(false);
      SFX.resume();
    }
  }

  function startGame(){
    if(state.over) resetAll();

    if(!state.running){
      state.running = true;
      state.paused = false;
      state.over = false;

      state.bag = makeBag();
      state.nextType = null;
      refillNextIfNeeded();
      spawn();

      updateSpeedByScore();
      updateHUD();

      setOverlay(false);
      SFX.start();
    }else if(state.paused){
      togglePause();
    }
  }

  function draw(){
    drawBoard(state.board);
    if(state.cur){
      const ghost = calcGhost(state.board, state.cur);
      drawGhost(ctx, ghost);
      drawPiece(ctx, state.cur, 1);
    }
  }

  function update(time = 0){
    const delta = time - state.lastTime;
    state.lastTime = time;

    if(state.running && !state.paused && !state.over){
      state.dropCounter += delta;
      if(state.dropCounter > state.dropInterval){
        softDrop();
        state.dropCounter = 0;
      }
    }

    draw();
    requestAnimationFrame(update);
  }

  // END 버튼 UI
  const endUI = { btn: null, badge: null };

  function getReturnUrl(){
    const qs = new URLSearchParams(location.search);
    const ret = qs.get("return");
    if(ret) {
      try { return decodeURIComponent(ret); } catch { return ret; }
    }
    return "../offchain.html";
  }

  function updateEndBadge(){
    if(endUI.badge) endUI.badge.textContent = String(state.score || 0);
  }

  function setupEndButton(){
    const style = document.createElement("style");
    style.textContent = `
      .tetris-end{
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
      .tetris-end .badge{
        display:inline-flex;
        align-items:center;
        padding: 4px 10px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,.14);
        background: rgba(255,255,255,.06);
        font-weight: 800;
      }
    `;
    document.head.appendChild(style);

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tetris-end";
    btn.innerHTML = `<span>END</span><span class="badge" id="tetrisEndBadge">0</span>`;
    document.body.appendChild(btn);

    endUI.btn = btn;
    endUI.badge = btn.querySelector("#tetrisEndBadge");

    btn.addEventListener("click", async () => {
      await SFX.unlock();

      const score = Number(state.score || 0);
      const qs = new URLSearchParams(location.search);
      const gameId = qs.get("game") || "tetris";
      const nonce = qs.get("nonce") || "";

      if(!nonce){
        alert("nonce 없음: offchain에서 joinGame부터 하세요.");
        return;
      }

      const address = window.ethereum?.selectedAddress;
      if(!address){
        alert("지갑 주소 없음: Rabby/MetaMask 연결을 확인하세요.");
        return;
      }

      const payload = `PAW_OFFCHAIN|${gameId}|${address}|${nonce}|${score}`;

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

      // localStorage 백업(디버그)
      localStorage.setItem("paw_score_tetris", String(score));
      localStorage.setItem("paw_sig_tetris", sig);
      localStorage.setItem("paw_payload_tetris", payload);

      const ret = getReturnUrl();
      const url = new URL(ret, location.href);
      url.searchParams.set("game", gameId);
      url.searchParams.set("score", String(score));
      url.searchParams.set("sig", sig);
      url.searchParams.set("payload", payload);

      location.href = url.toString();
    });

    updateEndBadge();
  }

  const keys = new Set();
  function preventScrollKey(k){
    return k === " " || k === "ArrowUp" || k === "ArrowDown" || k === "ArrowLeft" || k === "ArrowRight";
  }

  window.addEventListener("keydown", async (e) => {
    const k = e.key;
    if (preventScrollKey(k)) e.preventDefault();
    await SFX.unlock();

    if (k === "m" || k === "M"){
      state.muted = !state.muted;
      SFX.muteToggle(state.muted);
      return;
    }
    if (k === "p" || k === "P"){ togglePause(); return; }
    if (k === "r" || k === "R"){ resetAll(); return; }

    if (k === " "){
      if(!state.running || state.over) startGame();
      else hardDrop();
      return;
    }

    if(!state.running || state.paused || state.over) return;

    if(keys.has(k)) return;
    keys.add(k);

    if (k === "ArrowLeft") move(-1);
    else if (k === "ArrowRight") move(1);
    else if (k === "ArrowDown") softDrop();
    else if (k === "ArrowUp") rotate("CW");
    else if (k === "z" || k === "Z") rotate("CCW");
    else if (k === "c" || k === "C") hold();
  });

  window.addEventListener("keyup", (e) => {
    keys.delete(e.key);
  });

  btnStart.addEventListener("click", async () => { await SFX.unlock(); startGame(); });
  btnReset.addEventListener("click", async () => { await SFX.unlock(); resetAll(); });

  resetAll();
  setupEndButton();
  requestAnimationFrame(update);
})();
