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

  // Sound: prefer playing sampled audio files from /sounds, fallback to simple WebAudio tones
  const SFX = (() => {
    // sounds/ 폴더는 항상 tetris/ 의 상위(루트)에 위치
    // file:///.../tetris/index.html  → ../sounds/
    // http://localhost/.../tetris/   → ../sounds/
    const basePath = '../sounds/';
    const masterVolume = { v: 0.8 };

    // 각 이벤트별 최적 사운드 파일 매핑
    // move     : 블럭 좌우 이동
    // rotate   : 블럭 회전
    // fall     : 블럭이 자동으로 내려올 때(soft drop)
    // hard     : 하드드롭(스페이스)
    // lock     : 블럭이 바닥/다른 블럭에 닿아 고정
    // clear1~4 : 1~4줄 동시 클리어 (줄 수 많을수록 화려한 사운드)
    // score    : 점수 획득 (줄 클리어 외 하드드롭 보너스 등)
    // hold     : 홀드
    // over     : 게임오버
    // start    : 게임 시작
    // pause    : 일시정지
    // resume   : 재개
    const samples = {
      move:   '6071.mp3',              // 짧고 경쾌한 이동음
      rotate: '48183.mp3',             // 회전음
      fall:   'bricks-fall-315300.mp3',// 블럭 낙하 느낌
      hard:   'crush.mp3',             // 하드드롭 충격음
      lock:   'dropping-rocks-5996.mp3',// 고정 둔탁음
      clear1: 'din-ding-89718.mp3',    // 1줄 클리어: 경쾌한 딩
      clear2: '102844.mp3',            // 2줄 클리어
      clear3: 'reward.mp3',            // 3줄 클리어: 보상음
      clear4: 'levelup.mp3',           // 4줄(테트리스): 레벨업
      score:  'din-ding-89718.mp3',    // 점수 획득 알림
      hold:   'get.mp3',               // 홀드
      over:   'game-over.mp3',         // 게임오버
      start:  '185096.mp3',            // 게임 시작
      pause:  '185101.mp3',            // 일시정지
      resume: 'get.mp3',               // 재개
    };

    // WebAudio 컨텍스트 (fallback tone + AudioBuffer 재생 공용)
    let ctxA = null; let masterGain = null;
    function ensureCtx(){
      if (ctxA) return;
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      ctxA = new AudioCtx();
      masterGain = ctxA.createGain();
      masterGain.gain.value = masterVolume.v;
      masterGain.connect(ctxA.destination);
    }
    async function unlock(){
      try{
        ensureCtx();
        if (ctxA && ctxA.state === 'suspended') await ctxA.resume();
      }catch(e){}
    }

    // AudioBuffer 캐시: fetch → decodeAudioData 방식
    // file:// 프로토콜에서도 Audio 태그보다 안정적으로 동작
    const bufferCache = {};

    // HTMLAudio 캐시: fetch가 file:// 에서 막힐 경우의 2차 폴백
    const audioTagCache = {};

    async function loadBuffer(key, src){
      // 1차: fetch → WebAudio decodeAudioData (http/https 환경에 최적)
      try{
        const resp = await fetch(src);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const arrayBuf = await resp.arrayBuffer();
        ensureCtx();
        if (!ctxA) throw new Error('AudioContext 없음');
        const decoded = await ctxA.decodeAudioData(arrayBuf);
        bufferCache[key] = decoded;
        console.log(`[SFX] WebAudio 로드 성공: ${key}`);
        return;
      }catch(e){
        console.warn(`[SFX] fetch 실패(${key}): ${e.message} → HTMLAudio 폴백`);
      }
      // 2차: HTMLAudio 태그 (file:// 프로토콜 등)
      try{
        const a = new Audio(src);
        a.preload = 'auto';
        audioTagCache[key] = a;
        a.addEventListener('canplaythrough', () => console.log(`[SFX] HTMLAudio 로드 성공: ${key}`), {once:true});
        a.addEventListener('error', () => console.warn(`[SFX] HTMLAudio 로드 실패: ${key} → ${src}`), {once:true});
      }catch(e){
        console.warn(`[SFX] HTMLAudio 생성 실패: ${key}`, e.message);
      }
    }

    // 모든 사운드 파일 비동기 프리로드
    console.log('[SFX] basePath =', basePath);
    Object.keys(samples).forEach(k => {
      loadBuffer(k, basePath + samples[k]);
    });

    // WebAudio BufferSource 재생 (1순위)
    function playBuffer(key, opts={}){
      if (state.muted) return false;

      // 1순위: WebAudio BufferSource
      const buf = bufferCache[key];
      if (buf && ctxA){
        try{
          const src2 = ctxA.createBufferSource();
          src2.buffer = buf;
          if (opts.rate) src2.playbackRate.value = opts.rate;
          const gainNode = ctxA.createGain();
          gainNode.gain.value = Math.max(0, Math.min(1, (opts.vol||1)));
          src2.connect(gainNode);
          gainNode.connect(masterGain);
          src2.start(ctxA.currentTime);
          return true;
        }catch(e){ /* fallthrough */ }
      }

      // 2순위: HTMLAudio 태그
      const a = audioTagCache[key];
      if (a){
        try{
          const p = a.cloneNode(true);
          p.volume = Math.max(0, Math.min(1, (opts.vol||1) * masterVolume.v));
          if (opts.rate) p.playbackRate = opts.rate;
          p.play().catch(err => console.warn(`[SFX] HTMLAudio play 실패: ${key}`, err.message));
          return true;
        }catch(e){ /* fallthrough */ }
      }

      return false;
    }

    // fallback 단순 오실레이터 tone
    function tone(freq, dur=0.05, type='sine', vol=1){
      if (state.muted) return;
      ensureCtx(); if (!ctxA) return;
      const o = ctxA.createOscillator(); const g = ctxA.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, ctxA.currentTime);
      g.gain.setValueAtTime(0.0001, ctxA.currentTime);
      g.gain.exponentialRampToValueAtTime(0.12 * vol, ctxA.currentTime + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, ctxA.currentTime + dur);
      o.connect(g); g.connect(masterGain);
      o.start(ctxA.currentTime); o.stop(ctxA.currentTime + dur + 0.01);
    }

    // playSample: bufferCache 우선, 없으면 false 반환 → 호출부에서 tone() fallback
    function playSample(key, opts={}){
      if (state.muted) return false;
      return playBuffer(key, opts);
    }

    // 여러 사운드를 딜레이를 두고 순서대로 재생
    function playSequence(keys, delayMs=80){
      keys.forEach((k, i) => {
        if (Array.isArray(k)){
          const [key, opts] = k;
          setTimeout(() => playSample(key, opts), i * delayMs);
        } else {
          setTimeout(() => playSample(k), i * delayMs);
        }
      });
    }

    return {
      unlock,
      setVolume(v){
        masterVolume.v = Math.max(0, Math.min(1, v));
        if (masterGain) masterGain.gain.value = masterVolume.v;
      },

      // 블럭 좌우 이동
      move(){ if(!playSample('move', {vol:0.7})) tone(220,0.03,'square',0.55); },

      // 블럭 회전
      rotate(){ if(!playSample('rotate', {vol:0.75})) tone(330,0.04,'triangle',0.65); },

      // 블럭 자동 낙하 / 소프트드롭 (내려올 때)
      fall(){ if(!playSample('fall', {vol:0.35})) tone(180,0.02,'square',0.35); },

      // 하드드롭 (스페이스: 강하게 떨어짐)
      hard(){ if(!playSample('hard', {vol:1.0})) tone(440,0.06,'triangle',0.85); },

      // 블럭 고정 (바닥/다른 블럭에 닿아 lock)
      lock(){ if(!playSample('lock', {vol:0.85})) tone(140,0.05,'sawtooth',0.6); },

      // 줄 클리어 (줄 수에 따라 사운드 구분, 4줄은 추가 보상음)
      clear(lines){
        if (lines === 1){
          if(!playSample('clear1', {vol:0.85})) tone(440,0.07,'triangle',0.9);
        } else if (lines === 2){
          if(!playSample('clear2', {vol:0.9})) tone(523,0.08,'triangle',0.95);
        } else if (lines === 3){
          if(!playSample('clear3', {vol:0.95})) tone(587,0.09,'triangle',1.0);
        } else {
          // 테트리스(4줄): clear4 재생 후 짧은 딜레이로 score도 재생해 화려하게
          if(!playSample('clear4', {vol:1.0})) tone(659,0.10,'triangle',1.1);
          setTimeout(()=> playSample('score', {vol:0.6, rate:1.3}), 350);
        }
      },

      // 점수 획득 (하드드롭 보너스 등 줄클리어 외 점수)
      score(){ playSample('score', {vol:0.5, rate:1.1}); },

      // 홀드
      hold(){ if(!playSample('hold', {vol:0.8})) tone(262,0.06,'sine',0.7); },

      // 게임오버: game-over 재생 + 낙하 사운드 딜레이 연출
      over(){
        if(!playSample('over', {vol:1.0})){
          [392,330,262,196].forEach((f,i)=>setTimeout(()=>tone(f,0.12,'sawtooth',0.9), i*90));
        }
        // 추가 강조: 잠시 후 lock 사운드 여운
        setTimeout(()=> playSample('lock', {vol:0.4}), 600);
      },

      // 게임 시작
      start(){
        if(!playSample('start', {vol:0.9})) tone(523,0.09,'triangle',0.9);
      },

      // 일시정지
      pause(){ if(!playSample('pause', {vol:0.75})) tone(200,0.06,'sine',0.8); },

      // 재개
      resume(){ if(!playSample('resume', {vol:0.8})) tone(260,0.06,'sine',0.8); },

      muteToggle(on){ state.muted = !!on; if(!on) { playSample('score', {vol:0.5}); } }
    };
  })();

  // Apply persisted sound settings (volume / mute) from localStorage and listen for changes
  try{
    const VOL_KEY = 'paw_tetris_sfx_volume';
    const MUTE_KEY = 'paw_tetris_sfx_muted';
    const vRaw = localStorage.getItem(VOL_KEY);
    if (vRaw !== null) {
      const v = Number(vRaw);
      if (!Number.isNaN(v) && typeof SFX.setVolume === 'function') SFX.setVolume(v);
    }
    const mRaw = localStorage.getItem(MUTE_KEY);
    if (mRaw !== null) {
      const m = mRaw === '1';
      if (typeof SFX.muteToggle === 'function') SFX.muteToggle(m);
    }

    window.addEventListener('storage', (e) => {
      try{
        if (!e.key) return;
        if (e.key === VOL_KEY) {
          const nv = Number(e.newValue || 0.8);
          if (!Number.isNaN(nv) && typeof SFX.setVolume === 'function') SFX.setVolume(nv);
        } else if (e.key === MUTE_KEY) {
          const nm = e.newValue === '1';
          if (typeof SFX.muteToggle === 'function') SFX.muteToggle(nm);
        }
      }catch(_){ }
    });
  }catch(_){ }

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

  // silent=true: 자동 낙하 (루프에서 호출) - 사운드 없음
  // silent=false: 플레이어가 아래 키를 눌러 소프트드롭 - 낙하 사운드 재생
  function softDrop(silent=false){
    if(!state.running || state.paused || state.over) return;
    const cand = { ...state.cur, y: state.cur.y + 1 };
    if(!collides(state.board, cand)){
      state.cur.y++;
      if(!silent) SFX.fall();
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
    if (dist > 0) SFX.score();  // 하드드롭 보너스 점수 획득 알림

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
        softDrop(true);  // 자동 낙하: 사운드 없음
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

  // ── 모바일 터치 컨트롤 ──────────────────────────────────────────
  function setupMobileControls(){
    const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
    if (!isTouch) return;

    // 컨트롤 컨테이너를 <main class="layout"> 바로 다음에 삽입
    // (.layout 안에 넣으면 grid 레이아웃을 깨므로 반드시 바깥에)
    const layoutEl = document.querySelector('main.layout');
    const ctrl = document.createElement('div');
    ctrl.className = 'mobile-ctrl';
    // 행 1: 좌/우 이동 + 회전(반시계/시계)
    // 행 2: 소프트드롭 / 하드드롭 / 홀드
    // 행 3: 유틸 (시작, 일시정지, 리셋, 음소거)
    ctrl.innerHTML = `
      <div class="ctrl-row">
        <button class="ctrl-btn ctrl-btn--move" id="tctrlLeft">◀</button>
        <button class="ctrl-btn ctrl-btn--rot"  id="tctrlRotCCW">↺</button>
        <button class="ctrl-btn ctrl-btn--rot"  id="tctrlRotCW">↻</button>
        <button class="ctrl-btn ctrl-btn--move" id="tctrlRight">▶</button>
      </div>
      <div class="ctrl-row">
        <button class="ctrl-btn ctrl-btn--soft" id="tctrlSoft">▼ 소프트</button>
        <button class="ctrl-btn ctrl-btn--drop" id="tctrlHard">⬇ 하드드롭</button>
        <button class="ctrl-btn ctrl-btn--sm"   id="tctrlHold">📦 홀드</button>
      </div>
      <div class="ctrl-row">
        <button class="ctrl-btn ctrl-btn--sm"   id="tctrlStart">▶ 시작</button>
        <button class="ctrl-btn ctrl-btn--sm"   id="tctrlPause">⏸ P</button>
        <button class="ctrl-btn ctrl-btn--sm"   id="tctrlReset">↺ R</button>
        <button class="ctrl-btn ctrl-btn--sm"   id="tctrlMute">🔊 M</button>
      </div>
    `;
    if (layoutEl && layoutEl.parentNode){
      layoutEl.parentNode.insertBefore(ctrl, layoutEl.nextSibling);
    } else {
      document.querySelector('.app')?.appendChild(ctrl);
    }

    // 유틸: touchstart → 1회 실행
    function bindTap(id, fn){
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('touchstart', async (e) => {
        e.preventDefault();
        await SFX.unlock();
        fn();
      }, { passive: false });
    }

    // 좌/우: 누르는 동안 연속 이동 (DAS: Delayed Auto Shift 간이 구현)
    function bindDAS(id, fn){
      const el = document.getElementById(id);
      if (!el) return;
      let timer = null;
      el.addEventListener('touchstart', async (e) => {
        e.preventDefault();
        await SFX.unlock();
        fn();                                        // 즉시 1회
        timer = setInterval(fn, 110);               // 110ms 마다 반복
      }, { passive: false });
      const stop = () => { clearInterval(timer); timer = null; };
      el.addEventListener('touchend',   stop);
      el.addEventListener('touchcancel', stop);
    }

    bindDAS('tctrlLeft',  () => move(-1));
    bindDAS('tctrlRight', () => move(1));
    bindTap('tctrlRotCW',  () => rotate('CW'));
    bindTap('tctrlRotCCW', () => rotate('CCW'));
    bindDAS('tctrlSoft',  () => softDrop(false));
    bindTap('tctrlHard',  () => hardDrop());
    bindTap('tctrlHold',  () => hold());
    bindTap('tctrlStart', () => {
      if (!state.running || state.over) startGame();
      else if (state.paused) togglePause();
    });
    bindTap('tctrlPause', () => togglePause());
    bindTap('tctrlReset', () => resetAll());
    bindTap('tctrlMute',  () => {
      state.muted = !state.muted;
      SFX.muteToggle(state.muted);
      const btn = document.getElementById('tctrlMute');
      if (btn) btn.textContent = (state.muted ? '🔇' : '🔊') + ' M';
    });

    // ── 캔버스 스와이프 제스처 ─────────────────────────────────
    // 좌/우 스와이프 → 이동, 위 스와이프 → 회전, 아래 스와이프 → 소프트드롭
    // 짧은 탭(이동 없음) → 회전
    let swX = null, swY = null, swT = null;
    const SWIPE_MIN  = 28;   // px: 스와이프 인식 최소 거리
    const TAP_MAX_MS = 200;  // ms: 탭 인식 최대 시간
    const TAP_MAX_PX = 10;   // px: 탭 인식 최대 이동

    boardCanvas.addEventListener('touchstart', async (e) => {
      e.preventDefault();
      await SFX.unlock();
      swX = e.touches[0].clientX;
      swY = e.touches[0].clientY;
      swT = Date.now();
      // 시작 중이 아니면 시작
      if (!state.running || state.over) startGame();
    }, { passive: false });

    boardCanvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      if (swX === null) return;
      const dx = e.changedTouches[0].clientX - swX;
      const dy = e.changedTouches[0].clientY - swY;
      const dt = Date.now() - swT;
      const dist = Math.hypot(dx, dy);

      if (dist < TAP_MAX_PX && dt < TAP_MAX_MS){
        // 탭 → 시계 회전
        rotate('CW');
      } else if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > SWIPE_MIN){
        // 좌/우 스와이프 → 이동
        move(dx > 0 ? 1 : -1);
      } else if (dy < -SWIPE_MIN){
        // 위 스와이프 → 하드드롭
        hardDrop();
      } else if (dy > SWIPE_MIN){
        // 아래 스와이프 → 소프트드롭
        softDrop(false);
      }

      swX = null; swY = null; swT = null;
    }, { passive: false });

    boardCanvas.addEventListener('touchcancel', () => {
      swX = null; swY = null; swT = null;
    });
  }

  // ── 초기화 ─────────────────────────────────────────────────────
  resetAll();
  setupEndButton();
  setupMobileControls();
  requestAnimationFrame(update);
})();
