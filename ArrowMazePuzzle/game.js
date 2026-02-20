// /game.js
(() => {
  "use strict";

  const maskEl = document.getElementById("mask");
  const cv = document.getElementById("cv");
  const ctx = cv.getContext("2d");

  const uiHearts = document.getElementById("uiHearts");
  const uiLevel = document.getElementById("uiLevel");
  const toastEl = document.getElementById("toast");

  const btnReset = document.getElementById("btnReset");
  const btnUndo  = document.getElementById("btnUndo");
  const btnPrev  = document.getElementById("btnPrev");
  const btnNext  = document.getElementById("btnNext");
  const btnHearts = document.getElementById("btnHearts");
  const btnInfo  = document.getElementById("btnInfo");
  const btnGlow  = document.getElementById("btnGlow");

  const CSS = getComputedStyle(document.documentElement);
  const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

  function numVar(name, fallback){
    const v = parseFloat(CSS.getPropertyValue(name));
    return Number.isFinite(v) ? v : fallback;
  }
  const CELL   = () => numVar("--cell", 22);
  const STROKE = () => numVar("--stroke", 4.2);
  const ARROW  = () => numVar("--arrow", 8.5);
  const HITR   = () => numVar("--hit", 14);

  const DIRS = {
    U: {dx:0, dy:-1, ang:-Math.PI/2},
    R: {dx:1, dy:0,  ang:0},
    D: {dx:0, dy:1,  ang:Math.PI/2},
    L: {dx:-1,dy:0,  ang:Math.PI},
  };
  const OPP = { U:"D", D:"U", L:"R", R:"L" };

  const NEON = {
    white:"#e5e7eb",
    pink:"#fb3bb3",
    green:"#32ff7e",
    orange:"#ffb020",
    cyan:"#24d7ff",
    purple:"#8b5cf6",
  };
  const PALETTE = [NEON.white, NEON.pink, NEON.green, NEON.orange, NEON.cyan, NEON.purple];

  const styleState = { glow: true };

  function showToast(msg){
    toastEl.textContent = msg;
    toastEl.classList.add("on");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => toastEl.classList.remove("on"), 1200);
  }

  function renderHearts(){
    uiHearts.innerHTML = "";
    for(let i=0;i<state.heartsMax;i++){
      const h = document.createElement("span");
      h.className = "heart" + (i < state.hearts ? "" : " off");
      uiHearts.appendChild(h);
    }
  }

  function resizeCanvas(){
    const r = maskEl.getBoundingClientRect();
    cv.width  = Math.floor(r.width * DPR);
    cv.height = Math.floor(r.height * DPR);
    cv.style.width = r.width + "px";
    cv.style.height = r.height + "px";
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }

  function withAlpha(hex, a){
    const r = parseInt(hex.slice(1,3),16);
    const g = parseInt(hex.slice(3,5),16);
    const b = parseInt(hex.slice(5,7),16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function wait(ms){ return new Promise(r => setTimeout(r, ms)); }

  const state = {
    levelIndex: 0,
    heartsMax: 3,
    hearts: 3,

    w: 18,
    h: 18,
    circle: null,

    // runtime pieces: {id, dir, color, path:[{x,y}...]} path[0]=head
    pieces: [],

    animLock: false,
    undo: [],

    LEVELS: [],
  };

  function insideGrid(x,y){
    return x >= 0 && y >= 0 && x < state.w && y < state.h;
  }
  function insideCircleCell(x,y){
    if(!state.circle) return true;
    const {cx,cy,r} = state.circle;
    const dx = (x - cx);
    const dy = (y - cy);
    return (dx*dx + dy*dy) <= (r*r);
  }
  function cellAllowed(x,y){
    return insideGrid(x,y) && insideCircleCell(x,y);
  }

  function boardOrigin(){
    const cell = CELL();
    const r = maskEl.getBoundingClientRect();
    const ox = (r.width  - cell * state.w) / 2;
    const oy = (r.height - cell * state.h) / 2;
    return { ox, oy, cell };
  }
  function cellCenter(x,y){
    const {ox,oy,cell} = boardOrigin();
    return { x: ox + x*cell + cell/2, y: oy + y*cell + cell/2, cell };
  }

  function drawArrowHead(cx, cy, ang, color, size){
    if(styleState.glow){
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(ang);
      ctx.fillStyle = withAlpha(color, 0.35);
      ctx.beginPath();
      ctx.moveTo(size*1.25, 0);
      ctx.lineTo(-size*0.75, -size*0.85);
      ctx.lineTo(-size*0.75,  size*0.85);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(ang);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size*0.62, -size*0.72);
    ctx.lineTo(-size*0.62,  size*0.72);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function draw(){
    const r = maskEl.getBoundingClientRect();
    ctx.clearRect(0,0,r.width,r.height);

    if(state.circle){
      const {ox,oy,cell} = boardOrigin();
      const cx = ox + (state.circle.cx + 0.5) * cell;
      const cy = oy + (state.circle.cy + 0.5) * cell;
      const rr = state.circle.r * cell;

      ctx.save();
      ctx.strokeStyle = "rgba(255,255,255,.10)";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI*2);
      ctx.stroke();
      ctx.restore();
    }

    for(const p of state.pieces){
      if(p.path.length === 0) continue;
      const stroke = STROKE();
      const headSize = ARROW();
      const pts = p.path.map(c => cellCenter(c.x,c.y));

      if(styleState.glow){
        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = withAlpha(p.color, 0.30);
        ctx.lineWidth = stroke * 2.2;
        ctx.beginPath();
        for(let i=0;i<pts.length;i++){
          if(i===0) ctx.moveTo(pts[i].x, pts[i].y);
          else ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.stroke();
        ctx.restore();
      }

      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = p.color;
      ctx.lineWidth = stroke;
      ctx.beginPath();
      for(let i=0;i<pts.length;i++){
        if(i===0) ctx.moveTo(pts[i].x, pts[i].y);
        else ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.stroke();
      ctx.restore();

      const head = pts[0];
      drawArrowHead(head.x, head.y, DIRS[p.dir].ang, p.color, headSize);
    }
  }

  function pickPiece(px,py){
    const r = HITR();
    let best = null;
    let bestD = Infinity;

    for(const p of state.pieces){
      if(p.path.length === 0) continue;
      const h = p.path[0];
      const hc = cellCenter(h.x, h.y);
      const d = Math.hypot(px - hc.x, py - hc.y);
      if(d < r && d < bestD){
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  function occupiedByOthers(exceptId){
    const occ = new Set();
    for(const p of state.pieces){
      if(p.id === exceptId) continue;
      for(const c of p.path){
        occ.add(c.x + "," + c.y);
      }
    }
    return occ;
  }

  function deepCopyPieces(){
    return state.pieces.map(p => ({
      id:p.id, dir:p.dir, color:p.color,
      path: p.path.map(c => ({x:c.x,y:c.y}))
    }));
  }

  function pushUndo(){
    state.undo.push({ pieces: deepCopyPieces(), hearts: state.hearts });
    if(state.undo.length > 80) state.undo.shift();
  }

  function popUndo(){
    const snap = state.undo.pop();
    if(!snap) return false;
    state.pieces = snap.pieces.map(p => ({
      id:p.id, dir:p.dir, color:p.color,
      path: p.path.map(c => ({x:c.x,y:c.y}))
    }));
    state.hearts = snap.hearts;
    renderHearts();
    draw();
    return true;
  }

  function loseHeart(msg){
    state.hearts = Math.max(0, state.hearts - 1);
    renderHearts();
    showToast(msg + " (하트 -1)");
    if(state.hearts <= 0){
      showToast("하트 0: 레벨 리셋");
      state.hearts = state.heartsMax;
      renderHearts();
      loadLevel(state.levelIndex, { keepHearts:true, silent:true });
    }
  }

  function removePiece(id){
    state.pieces = state.pieces.filter(p => p.id !== id);
  }

  function isClear(){
    return state.pieces.length === 0;
  }

  async function animateUnravel(piece){
    // 규칙:
    // - 매 스텝: head가 dir 방향으로 1칸 전진(가능하면), tail 1칸 제거
    // - 다른 조각과 겹치면 즉시 실패(원상복구 + 하트-1)
    const v = DIRS[piece.dir];

    // 시작 검증: head 앞칸이 내부인데 점유면 시작 불가
    const head0 = piece.path[0];
    const nx0 = head0.x + v.dx;
    const ny0 = head0.y + v.dy;
    const occ0 = occupiedByOthers(piece.id);
    if(cellAllowed(nx0, ny0) && occ0.has(nx0 + "," + ny0)){
      return { ok:false, reason:"머리 앞이 막혀서 풀 수 없음" };
    }

    let progressed = false;
    let steps = 0;

    while(piece.path.length > 0){
      const occ = occupiedByOthers(piece.id);
      const head = piece.path[0];

      const nx = head.x + v.dx;
      const ny = head.y + v.dy;

      if(cellAllowed(nx, ny)){
        const k = nx + "," + ny;
        if(occ.has(k)){
          break;
        }
        piece.path.unshift({x:nx, y:ny});
        progressed = true;
      }else{
        // 경계 밖이면 head는 더 못 그리지만, tail이 계속 줄면서 완전 탈출되도록 진행
        progressed = true;
      }

      piece.path.pop();

      draw();
      await wait(18);

      steps++;
      if(steps > 200) break;
    }

    if(piece.path.length === 0){
      removePiece(piece.id);
      draw();
      await wait(40);
      return { ok:true, removed:true };
    }

    if(!progressed){
      return { ok:false, reason:"움직임 없음" };
    }

    return { ok:false, reason:"중간에 막혀 더 이상 풀 수 없음" };
  }

  async function onClick(e){
    if(state.animLock) return;

    const rect = cv.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;

    const picked = pickPiece(px,py);
    if(!picked){
      showToast("화살표 머리를 클릭하세요");
      return;
    }

    pushUndo();
    state.animLock = true;

    const r = await animateUnravel(picked);

    state.animLock = false;

    if(!r.ok){
      popUndo();
      loseHeart(r.reason);
      return;
    }

    if(isClear()){
      showToast("클리어");
    }else{
      showToast("계속 진행");
    }
  }

  function loadLevel(index, opts){
    opts = opts || {};
    state.levelIndex = Math.max(0, Math.min(state.LEVELS.length - 1, index));
    const lv = state.LEVELS[state.levelIndex];

    state.w = lv.w;
    state.h = lv.h;
    state.circle = lv.circle;

    state.pieces = lv.pieces.map(p => ({
      id: p.id,
      dir: p.dir,
      color: p.color,
      path: p.path.map(c => ({x:c.x, y:c.y}))
    }));

    state.undo = [];

    uiLevel.textContent = "Level " + String(state.levelIndex + 1);

    if(!opts.keepHearts) state.hearts = state.heartsMax;
    renderHearts();

    resizeCanvas();
    draw();

    if(!opts.silent) showToast("머리 클릭: 화살표 방향으로 풀려 나감");
  }

  // ---------------------------
  // 레벨 생성기 + 솔버
  // ---------------------------

  function rngFactory(seed){
    let s = seed >>> 0;
    return {
      next(){
        // xorshift32
        s ^= s << 13; s >>>= 0;
        s ^= s >> 17; s >>>= 0;
        s ^= s << 5;  s >>>= 0;
        return (s >>> 0) / 4294967296;
      },
      int(a,b){
        return a + Math.floor(this.next() * (b - a + 1));
      },
      pick(arr){
        return arr[this.int(0, arr.length - 1)];
      }
    };
  }

  function circleAllowed(w,h,circle,x,y){
    if(x < 0 || y < 0 || x >= w || y >= h) return false;
    const dx = (x - circle.cx);
    const dy = (y - circle.cy);
    return (dx*dx + dy*dy) <= (circle.r*circle.r);
  }

  function buildSnakePath(rng, w, h, circle, head, dir, targetLen){
    // path[0] = head
    // 꼬리는 반드시 dir의 반대 방향으로 먼저 2~6칸 뻗음 (거꾸로 보임 방지)
    const path = [{x:head.x, y:head.y}];
    const used = new Set([head.x + "," + head.y]);

    const v = DIRS[OPP[dir]];
    const firstRun = Math.min(targetLen - 1, rng.int(2, 6));

    let cx = head.x;
    let cy = head.y;

    for(let i=0;i<firstRun;i++){
      const nx = cx + v.dx;
      const ny = cy + v.dy;
      if(!circleAllowed(w,h,circle,nx,ny)) break;
      const k = nx + "," + ny;
      if(used.has(k)) break;
      used.add(k);
      path.push({x:nx,y:ny});
      cx = nx; cy = ny;
      if(path.length >= targetLen) return path;
    }

    // 이후: 꼬불꼬불(직각) 생성
    // 방향 후보: 현재 진행방향 유지 + 좌/우 회전 + 가끔 역방향(너무 잦으면 지저분)
    let tailDir = OPP[dir];

    function leftOf(d){
      return d === "U" ? "L" : d === "L" ? "D" : d === "D" ? "R" : "U";
    }
    function rightOf(d){
      return d === "U" ? "R" : d === "R" ? "D" : d === "D" ? "L" : "U";
    }

    while(path.length < targetLen){
      const roll = rng.next();
      let nd = tailDir;
      if(roll < 0.34) nd = tailDir;
      else if(roll < 0.67) nd = leftOf(tailDir);
      else if(roll < 0.92) nd = rightOf(tailDir);
      else nd = OPP[tailDir];

      const run = rng.int(1, 4);
      let moved = false;

      for(let i=0;i<run && path.length < targetLen;i++){
        const dv = DIRS[nd];
        const nx = cx + dv.dx;
        const ny = cy + dv.dy;
        if(!circleAllowed(w,h,circle,nx,ny)) break;
        const k = nx + "," + ny;
        if(used.has(k)) break;
        used.add(k);
        path.push({x:nx,y:ny});
        cx = nx; cy = ny;
        moved = true;
      }

      if(moved){
        tailDir = nd;
      }else{
        // 막히면 방향만 바꿔서 재시도, 그래도 연속 실패면 종료
        let tries = 0;
        let ok = false;
        while(tries < 6 && !ok){
          tries++;
          const cand = rng.pick(["U","R","D","L"]);
          const dv = DIRS[cand];
          const nx = cx + dv.dx;
          const ny = cy + dv.dy;
          const k = nx + "," + ny;
          if(circleAllowed(w,h,circle,nx,ny) && !used.has(k)){
            used.add(k);
            path.push({x:nx,y:ny});
            cx = nx; cy = ny;
            tailDir = cand;
            ok = true;
          }
        }
        if(!ok) break;
      }
    }

    return path;
  }

  function overlapsAny(path, occ){
    for(const c of path){
      const k = c.x + "," + c.y;
      if(occ.has(k)) return true;
    }
    return false;
  }

  function addToOcc(path, occ){
    for(const c of path) occ.add(c.x + "," + c.y);
  }

  function listValidMoves(level){
    // level: {w,h,circle,pieces:[{id,dir,color,path}]}
    // move is valid only if unravel completes to empty without collision at any step
    const moves = [];
    for(let i=0;i<level.pieces.length;i++){
      if(simulateUnravelMove(level, i).ok){
        moves.push(i);
      }
    }
    return moves;
  }

  function cloneLevel(level){
    return {
      w: level.w,
      h: level.h,
      circle: level.circle,
      pieces: level.pieces.map(p => ({
        id:p.id, dir:p.dir, color:p.color,
        path: p.path.map(c => ({x:c.x,y:c.y}))
      }))
    };
  }

  function simulateUnravelMove(level, pieceIndex){
    // 규칙 동일: 매 스텝 head forward 가능하면 unshift, tail pop
    // 충돌 시 실패, 완전 비면 성공(제거)
    const w = level.w, h = level.h, circle = level.circle;
    const p = level.pieces[pieceIndex];
    const v = DIRS[p.dir];

    function allowed(x,y){
      if(x < 0 || y < 0 || x >= w || y >= h) return false;
      const dx = (x - circle.cx);
      const dy = (y - circle.cy);
      return (dx*dx + dy*dy) <= (circle.r*circle.r);
    }

    const occ = new Set();
    for(let i=0;i<level.pieces.length;i++){
      if(i === pieceIndex) continue;
      for(const c of level.pieces[i].path) occ.add(c.x + "," + c.y);
    }

    // 시작 막힘 체크
    if(p.path.length === 0) return { ok:false };
    const h0 = p.path[0];
    const nx0 = h0.x + v.dx;
    const ny0 = h0.y + v.dy;
    if(allowed(nx0, ny0) && occ.has(nx0 + "," + ny0)) return { ok:false };

    // 시뮬레이션 (max step = path length + 여유)
    const path = p.path.map(c => ({x:c.x,y:c.y}));
    let steps = 0;
    while(path.length > 0 && steps < 400){
      const head = path[0];
      const nx = head.x + v.dx;
      const ny = head.y + v.dy;

      if(allowed(nx,ny)){
        const k = nx + "," + ny;
        if(occ.has(k)) return { ok:false };
        path.unshift({x:nx,y:ny});
      }
      path.pop();
      steps++;
    }

    if(path.length === 0) return { ok:true };
    return { ok:false };
  }

  function applyUnravelMove(level, pieceIndex){
    // simulate + apply actual piece removal
    const r = simulateUnravelMove(level, pieceIndex);
    if(!r.ok) return null;
    const next = cloneLevel(level);
    next.pieces.splice(pieceIndex, 1);
    return next;
  }

  function hashLevel(level){
    // occupancy signature
    // piece order not important -> sort by id for stability
    const parts = level.pieces
      .slice()
      .sort((a,b) => a.id.localeCompare(b.id))
      .map(p => {
        const head = p.path[0];
        const tail = p.path[p.path.length - 1];
        return [
          p.id, p.dir,
          head ? head.x + ":" + head.y : "x",
          tail ? tail.x + ":" + tail.y : "x",
          p.path.length
        ].join("|");
      });
    return parts.join("~");
  }

  function isSolvable(level, maxStates){
    // DFS with memo
    const seen = new Set();
    let states = 0;

    function dfs(cur){
      states++;
      if(states > maxStates) return false; // 시간 제한
      if(cur.pieces.length === 0) return true;

      const key = hashLevel(cur);
      if(seen.has(key)) return false;
      seen.add(key);

      const moves = listValidMoves(cur);
      // 난이도: 가능한 move가 적을수록 어려움 -> 그 순서대로 탐색해도 풀리는지 확인
      for(const mi of moves){
        const next = applyUnravelMove(cur, mi);
        if(next && dfs(next)) return true;
      }
      return false;
    }

    return dfs(level);
  }

  function generateLevel(levelNo, baseSeed){
    const w = 18, h = 18;
    const circle = { cx: 9, cy: 9, r: 8.2 };

    const rng = rngFactory((baseSeed + levelNo * 9973) >>> 0);

    // 난이도 스케일
    const piecesCount = Math.min(8 + Math.floor((levelNo - 1) * 0.45), 18); // Lv30 근처 18개
    const minLen = 6 + Math.floor((levelNo - 1) * 0.12);
    const maxLen = 14 + Math.floor((levelNo - 1) * 0.25);

    // 시작 가능한 move 수 제한(뒤로 갈수록 더 적게)
    const targetMaxStartMoves = Math.max(1, 6 - Math.floor((levelNo - 1) / 6));

    let tries = 0;
    while(tries < 1200){
      tries++;

      const occ = new Set();
      const pieces = [];
      let idCounter = 0;

      const attemptSeedJitter = rng.int(0, 1_000_000);

      const rr = rngFactory(((baseSeed ^ (levelNo*2654435761)) + attemptSeedJitter) >>> 0);

      for(let i=0;i<piecesCount;i++){
        // head 위치 찾기
        let placed = false;

        for(let t=0;t<240 && !placed;t++){
          const x = rr.int(1, w-2);
          const y = rr.int(1, h-2);
          if(!circleAllowed(w,h,circle,x,y)) continue;
          const headKey = x + "," + y;
          if(occ.has(headKey)) continue;

          const dir = rr.pick(["U","R","D","L"]);
          const len = rr.int(minLen, maxLen);

          const path = buildSnakePath(rr, w, h, circle, {x,y}, dir, len);
          if(path.length < Math.max(5, minLen - 2)) continue;

          // 겹침 체크
          if(overlapsAny(path, occ)) continue;

          // 시각 품질: head 뒤 칸이 dir 반대여야 자연스럽다(거꾸로 방지)
          if(path.length >= 2){
            const h0 = path[0], h1 = path[1];
            const vx = h1.x - h0.x;
            const vy = h1.y - h0.y;
            const back = DIRS[OPP[dir]];
            if(vx !== back.dx || vy !== back.dy) continue;
          }

          addToOcc(path, occ);

          const color = PALETTE[i % PALETTE.length];
          const id = "p" + String(levelNo) + "_" + String(++idCounter);

          pieces.push({ id, dir, color, path });
          placed = true;
        }

        if(!placed){
          break; // 이 시도 실패
        }
      }

      if(pieces.length !== piecesCount) continue;

      const level = { w, h, circle, pieces };

      // 시작 가능한 move 수 체크(너무 쉬우면 버림)
      const startMoves = listValidMoves(level).length;
      if(startMoves > targetMaxStartMoves) continue;

      // 솔버로 반드시 풀리는 것만 통과
      // 레벨 뒤로 갈수록 더 어렵게: 상태 제한도 조금 늘림
      const maxStates = 40_000 + (levelNo * 2_000);
      const solvable = isSolvable(level, maxStates);
      if(!solvable) continue;

      return level;
    }

    // 최후: 안전하게 매우 쉬운 레벨(항상 풀림) 반환
    // (실제로는 위 루프에서 대부분 잡힘)
    const fallback = {
      w, h, circle,
      pieces: [
        { id:"fb1", dir:"R", color:NEON.cyan, path: [{x:6,y:9},{x:5,y:9},{x:4,y:9},{x:3,y:9},{x:2,y:9}] },
        { id:"fb2", dir:"L", color:NEON.pink, path: [{x:12,y:9},{x:13,y:9},{x:14,y:9},{x:15,y:9}] },
      ]
    };
    return fallback;
  }

  function buildLevels30(){
    const baseSeed = 0xC0FFEE42;
    const levels = [];
    for(let i=1;i<=30;i++){
      levels.push(generateLevel(i, baseSeed));
    }
    return levels;
  }

  function init(){
    state.LEVELS = buildLevels30();
    state.levelIndex = 0;

    renderHearts();
    loadLevel(0, { silent:true });
    showToast("Level 1 시작");
  }

  // UI wiring
  btnReset.addEventListener("click", () => loadLevel(state.levelIndex, { keepHearts:true }));
  btnUndo.addEventListener("click", () => {
    if(state.animLock) return;
    const ok = popUndo();
    showToast(ok ? "되돌림" : "되돌릴 것 없음");
  });
  btnPrev.addEventListener("click", () => {
    if(state.animLock) return;
    loadLevel(state.levelIndex - 1);
  });
  btnNext.addEventListener("click", () => {
    if(state.animLock) return;
    loadLevel(state.levelIndex + 1);
  });
  btnHearts.addEventListener("click", () => {
    state.hearts = state.heartsMax;
    renderHearts();
    showToast("하트 초기화");
  });

  btnInfo.addEventListener("click", () => {
    showToast("규칙: 머리 클릭 → 해당 방향으로 풀림. 겹침은 즉시 실패");
  });

  btnGlow.addEventListener("click", () => {
    styleState.glow = !styleState.glow;
    draw();
    showToast(styleState.glow ? "글로우 ON" : "글로우 OFF");
  });

  cv.addEventListener("click", onClick);
  window.addEventListener("resize", () => { resizeCanvas(); draw(); });

  // boot
  resizeCanvas();
  init();
})();