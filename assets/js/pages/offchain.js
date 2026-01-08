// /assets/js/pages/offchain.js
(async () => {
  const ethers = window.ethers;
  const $ = (id) => document.getElementById(id);

  const btnJoin = $("btnJoin");
  const btnSave = $("btnSave");
  const btnOpen = $("btnOpenBaccarat");

  const joinHint = $("joinHint");
  const saveHint = $("saveHint");
  const openHint = $("openHint");
  const inScore = $("inScore");

  function fmt18(v){
    try{ return ethers.formatUnits(v, 18); }
    catch{ return String(v); }
  }
  function fmtTs(ts){
    const n = Number(ts || 0);
    if(!n) return "-";
    return new Date(n * 1000).toLocaleString();
  }
  function setText(id, v){
    const el = $(id);
    if(el) el.textContent = v;
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

  async function refresh(){
    try{
      const ctx = await getCtx();
      const { address, gameRead } = ctx;

      const [u, timeout, power] = await Promise.all([
        gameRead.user(address),
        gameRead.pendingTimeout(),
        gameRead.dividendPower(address),
      ]);

      setText("uPending", u.pendingGame ? "YES" : "NO");
      setText("uPendingAt", fmtTs(u.pendingAt));
      setText("uTimeout", String(timeout) + " sec");
      setText("uNum", String(u.numerator));
      setText("uPower", fmt18(power) + " HEX/day");

      if (joinHint) joinHint.textContent = u.pendingGame ? "pending 상태" : "대기";
    }catch(e){
      // 연결 전 조용히
    }
  }

  // 바카라 점수 불러오기(선택)
  function loadBaccaratScore(){
    const raw = localStorage.getItem("paw_score_baccarat");
    if(!raw) return;
    const score = parseInt(raw, 10) || 0;
    if(score > 0 && inScore){
      inScore.value = String(score);
      openHint && (openHint.textContent = `점수 불러옴: ${score}`);
    }
  }

  btnJoin?.addEventListener("click", async () => {
    try{
      joinHint && (joinHint.textContent = "joinGame 서명...");
      const ctx = await getCtx();
      const tx = await ctx.game.joinGame();
      await tx.wait();
      joinHint && (joinHint.textContent = "joinGame 완료");
      await refresh();
    }catch(e){
      joinHint && (joinHint.textContent = e?.shortMessage || e?.message || "실패");
    }
  });

  btnOpen?.addEventListener("click", (e) => {
    e.preventDefault();
    try{
      openHint && (openHint.textContent = "열기...");
      const returnUrl = encodeURIComponent("../offchain.html");
      location.href = `baccarat/index.html?return=${returnUrl}`;
    }catch(err){
      openHint && (openHint.textContent = err?.message || "실패");
    }
  });

  btnSave?.addEventListener("click", async () => {
    try{
      const raw = (inScore?.value || "").trim();
      const score = parseInt(raw, 10);

      if(!Number.isFinite(score) || score <= 0){
        saveHint && (saveHint.textContent = "점수를 입력하세요");
        return;
      }

      // 규칙: 1:1 저장 (score/10 제거)
      saveHint && (saveHint.textContent = "saveGame 서명...");
      const ctx = await getCtx();

      // pending 상태인지 확인(실패 원인 선제 차단)
      const u = await ctx.gameRead.user(ctx.address);
      if(!u.pendingGame){
        saveHint && (saveHint.textContent = "pending 상태가 아닙니다. 먼저 joinGame 하세요");
        return;
      }

      const tx = await ctx.game.saveGame(score);
      await tx.wait();

      saveHint && (saveHint.textContent = "saveGame 완료");
      localStorage.removeItem("paw_score_baccarat");
      await refresh();
    }catch(e){
      saveHint && (saveHint.textContent = e?.shortMessage || e?.message || "실패");
    }
  });

  // 초기
  loadBaccaratScore();
  refresh();
  setInterval(refresh, 5000);
})();
