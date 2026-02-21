// /assets/js/pages/offchain.js
// 파일은 1개만 교체하면 되도록, 게임 2개(바카라/테트리스)를 한 번에 처리합니다.
// 점수 입력난은 없고, 게임 END에서 localStorage로 결과가 저장되는 구조입니다.

(async () => {
  const ethers = window.ethers;
  const $ = (id) => document.getElementById(id);

  const GAMES = {
    baccarat: {
      id: "baccarat",
      title: "바카라",
      openPath: "baccarat/index.html",
      btnJoin: "btnJoin",
      joinHint: "joinHint",
      btnOpen: "btnOpenBaccarat",
      openHint: "openHintB",
      scoreView: "bScore",
      btnSave: "btnSaveB",
      saveHint: "saveHintB",
    },
    tetris: {
      id: "tetris",
      title: "테트리스",
      openPath: "tetris/index.html",
      btnJoin: "btnJoinT",
      joinHint: "joinHintT",
      btnOpen: "btnOpenTetris",
      openHint: "openHintT",
      scoreView: "tScore",
      btnSave: "btnSaveT",
      saveHint: "saveHintT",
    },
    breakout: {
      id: "breakout",
      title: "벽돌깨기",
      openPath: "breakout/index.html",
      btnJoin: "btnJoinBr",
      joinHint: "joinHintBr",
      btnOpen: "btnOpenBreakout",
      openHint: "openHintBr",
      scoreView: "brScore",
      btnSave: "btnSaveBr",
      saveHint: "saveHintBr",
    },
    lastshelter: {
      id: "lastshelter",
      title: "라스트셸터",
      openPath: "lastshelter_patched_v3_airstrike/index.html",
      btnJoin: "btnJoinLs",
      joinHint: "joinHintLs",
      btnOpen: "btnOpenLastshelter",
      openHint: "openHintLs",
      scoreView: "lsScore",
      btnSave: "btnSaveLs",
      saveHint: "saveHintLs",
    },
    suika: {
      id: "suika",
      title: "수이카",
      openPath: "suika_fixed/index.html",
      btnJoin: "btnJoinSu",
      joinHint: "joinHintSu",
      btnOpen: "btnOpenSuika",
      openHint: "openHintSu",
      scoreView: "suScore",
      btnSave: "btnSaveSu",
      saveHint: "saveHintSu",
    },
  };

  const LS = {
    nonce: (gid) => `paw_nonce_${gid}`,
    score: (gid) => `paw_score_${gid}`,
    sig: (gid) => `paw_sig_${gid}`,
    payload: (gid) => `paw_payload_${gid}`,
  };

  function fmt18(v){
    try { return ethers.formatUnits(v, 18); }
    catch { return String(v); }
  }
  function fmtTs(ts){
    const n = Number(ts || 0);
    if(!n) return "-";
    return new Date(n * 1000).toLocaleString();
  }
  function nowNonce(){
    return "n" + Math.random().toString(16).slice(2) + Date.now().toString(16);
  }
  function normAddr(a){
    return String(a || "").toLowerCase();
  }
  function setHint(id, msg){
    const el = $(id);
    if(el) el.textContent = msg;
  }

  function parsePayload(payload){
    // PAW_OFFCHAIN|<gameId>|<address>|<nonce>|<score>
    const s = String(payload || "");
    const parts = s.split("|");
    if(parts.length !== 5) return null;
    if(parts[0] !== "PAW_OFFCHAIN") return null;
    return {
      gameId: parts[1] || "",
      address: parts[2] || "",
      nonce: parts[3] || "",
      score: Number(parts[4]),
      raw: s,
    };
  }

  function requireWalletApi(){
    if(!window.Wallet || typeof Wallet.getContext !== "function"){
      throw new Error("wallet.js가 로드되지 않았습니다");
    }
  }

  async function getCtx(){
    requireWalletApi();
    const ctx = await Wallet.getContext();
    if(!ctx || !ctx.address || !ctx.game || !ctx.gameRead){
      throw new Error("지갑 연결 후 이용하세요");
    }
    return ctx;
  }

  async function refreshStatus(){
    try{
      const ctx = await getCtx();
      const { address, gameRead } = ctx;

      const [u, timeout, power] = await Promise.all([
        gameRead.user(address),
        gameRead.pendingTimeout(),
        gameRead.dividendPower(address),
      ]);

      const uPending = $("uPending");
      const uPendingAt = $("uPendingAt");
      const uTimeout = $("uTimeout");
      const uNum = $("uNum");
      const uPower = $("uPower");

      if(uPending) uPending.textContent = u.pendingGame ? "YES" : "NO";
      if(uPendingAt) uPendingAt.textContent = fmtTs(u.pendingAt);
      if(uTimeout) uTimeout.textContent = String(timeout) + " sec";
      if(uNum) uNum.textContent = String(u.numerator);
      if(uPower) uPower.textContent = fmt18(power) + " HEX/day";

      // 각 카드 joinHint
      for(const gid of Object.keys(GAMES)){
        const g = GAMES[gid];
        setHint(g.joinHint, u.pendingGame ? "pending" : "대기");
      }
    }catch(_e){
      // 연결 전: 조용히
    }
  }

  function loadScoreToUI(gid){
    const g = GAMES[gid];
    const el = $(g.scoreView);
    if(!el) return;
    const s = localStorage.getItem(LS.score(gid));
    el.textContent = s ? String(s) : "-";
  }

  function clearLocalResult(gid){
    localStorage.removeItem(LS.score(gid));
    localStorage.removeItem(LS.sig(gid));
    localStorage.removeItem(LS.payload(gid));
  }

  async function handleJoin(gid){
    const g = GAMES[gid];
    try{
      setHint(g.joinHint, "joinGame 전송...");
      const ctx = await getCtx();

      const nonce = nowNonce();
      localStorage.setItem(LS.nonce(gid), nonce);
      clearLocalResult(gid);
      loadScoreToUI(gid);
      setHint(g.saveHint, "-");
      setHint(g.openHint, "-");

      const tx = await ctx.game.joinGame();
      await tx.wait();

      setHint(g.joinHint, "pending");
      await refreshStatus();
    }catch(e){
      setHint(g.joinHint, e?.shortMessage || e?.message || "실패");
    }
  }

  async function handleOpen(gid){
    const g = GAMES[gid];
    try{
      const ctx = await getCtx();
      setHint(g.openHint, "pending 확인...");

      const u = await ctx.gameRead.user(ctx.address);
      if(!u.pendingGame) throw new Error("pending 상태가 아닙니다. 먼저 joinGame 하세요");

      const nonce = localStorage.getItem(LS.nonce(gid));
      if(!nonce) throw new Error("nonce 없음: joinGame부터 하세요");

      const ret = encodeURIComponent("../offchain.html");
      location.href = `${g.openPath}?return=${ret}&game=${encodeURIComponent(gid)}&nonce=${encodeURIComponent(nonce)}`;
    }catch(e){
      setHint(g.openHint, e?.message || "실패");
    }
  }

  async function handleSave(gid){
    const g = GAMES[gid];
    try{
      const ctx = await getCtx();
      setHint(g.saveHint, "검증중...");

      const u = await ctx.gameRead.user(ctx.address);
      if(!u.pendingGame){
        setHint(g.saveHint, "pending 상태가 아닙니다. 먼저 joinGame 하세요");
        return;
      }

      const scoreRaw = localStorage.getItem(LS.score(gid));
      const sig = localStorage.getItem(LS.sig(gid));
      const payload = localStorage.getItem(LS.payload(gid));
      const nonceStored = localStorage.getItem(LS.nonce(gid));

      const score = Number(scoreRaw);
      if(!nonceStored) throw new Error("nonce 없음: joinGame부터 하세요");
      if(!payload || !sig) throw new Error("END 결과 없음: 게임에서 END를 눌러야 합니다");
      if(!Number.isFinite(score) || score < 0) throw new Error("점수 오류");

      const p = parsePayload(payload);
      if(!p) throw new Error("payload 형식 오류");
      if(p.gameId !== gid) throw new Error("payload gameId 불일치");
      if(p.nonce !== nonceStored) throw new Error("payload nonce 불일치");
      if(p.score !== score) throw new Error("payload score 불일치");

      const signer = ethers.verifyMessage(payload, sig);
      if(normAddr(signer) !== normAddr(ctx.address)) throw new Error("서명 검증 실패");

      setHint(g.saveHint, "saveGame 전송...");
      const tx = await ctx.game.saveGame(score);
      await tx.wait();

      setHint(g.saveHint, "저장 완료");

      // 성공 후 세션 정리
      localStorage.removeItem(LS.nonce(gid));
      clearLocalResult(gid);
      loadScoreToUI(gid);

      await refreshStatus();
    }catch(e){
      setHint(g.saveHint, e?.shortMessage || e?.message || "실패");
    }
  }

  function acceptReturnFromGame(){
    // 게임에서 돌아오면 query에 game=...&score=...&sig=...&payload=... 가 붙을 수 있음
    const qs = new URLSearchParams(location.search);
    const gid = qs.get("game");
    if(!gid || !GAMES[gid]) return;

    const score = qs.get("score");
    const sig = qs.get("sig");
    const payload = qs.get("payload");

    if(score && sig && payload){
      localStorage.setItem(LS.score(gid), String(score));
      localStorage.setItem(LS.sig(gid), String(sig));
      localStorage.setItem(LS.payload(gid), String(payload));
      loadScoreToUI(gid);
      setHint(GAMES[gid].saveHint, "END 수신됨 → 결과 저장 누르세요");
    }

    // URL 정리(새로고침 시 반복 처리 방지)
    qs.delete("score");
    qs.delete("sig");
    qs.delete("payload");
    const clean = location.pathname + (qs.toString() ? `?${qs.toString()}` : "");
    history.replaceState({}, "", clean);
  }

  function bindUI(){
    for(const gid of Object.keys(GAMES)){
      const g = GAMES[gid];

      $(g.btnJoin)?.addEventListener("click", () => handleJoin(gid));
      $(g.btnOpen)?.addEventListener("click", (e) => { e.preventDefault(); handleOpen(gid); });
      $(g.btnSave)?.addEventListener("click", () => handleSave(gid));

      loadScoreToUI(gid);
    }

    // Tetris sound controls (store settings in localStorage so tetris window can pick up)
    const volEl = $("tetrisSfxVol");
    const valEl = $("tetrisSfxVal");
    const muteBtn = $("tetrisSfxMute");
    if(volEl && valEl){
      const keyVol = 'paw_tetris_sfx_volume';
      const keyMute = 'paw_tetris_sfx_muted';
      const stored = localStorage.getItem(keyVol);
      const init = stored !== null ? Number(stored) : 0.8;
      const percent = Math.round((init || 0.8) * 100);
      volEl.value = percent;
      valEl.textContent = percent + '%';

      volEl.addEventListener('input', () => {
        const p = Number(volEl.value || 80);
        valEl.textContent = p + '%';
        const v = Math.max(0, Math.min(1, p/100));
        localStorage.setItem(keyVol, String(v));
      });

      // mute
      const storedMute = localStorage.getItem(keyMute) === '1';
      muteBtn.textContent = storedMute ? 'Unmute' : 'Mute';
      muteBtn.addEventListener('click', () => {
        const cur = localStorage.getItem(keyMute) === '1';
        const next = cur ? '0' : '1';
        localStorage.setItem(keyMute, next);
        muteBtn.textContent = next === '1' ? 'Unmute' : 'Mute';
      });
    }
  }

  // init
  bindUI();
  acceptReturnFromGame();
  refreshStatus();
  setInterval(refreshStatus, 5000);
})();
