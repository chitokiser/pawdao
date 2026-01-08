// /assets/js/pages/mypage.js
(() => {
  const ethers = window.ethers;
  const $ = (id) => document.getElementById(id);

  function compactNum(n) {
    const x = Number(n);
    if (!Number.isFinite(x)) return String(n);
    if (x === 0) return "0";
    if (x >= 1e9) return (x / 1e9).toFixed(2) + "B";
    if (x >= 1e6) return (x / 1e6).toFixed(2) + "M";
    if (x >= 1e3) return (x / 1e3).toFixed(2) + "K";
    if (x >= 100) return x.toFixed(2);
    if (x >= 1) return x.toFixed(4);
    return x.toFixed(6);
  }

  function fmtTime(ts) {
    const n = Number(ts);
    if (!n) return "-";
    return new Date(n * 1000).toLocaleString();
  }

  function fmt18(v) {
    try { return ethers.formatUnits(v, 18); }
    catch { return String(v); }
  }

  async function getCtx() {
    if (!window.Wallet) throw new Error("wallet.js 로드 필요");
    return await Wallet.requireConnected();
  }

  async function getHexContract(ctx) {
    const app = window.APP;
    const hexAddr = (app.TOKENS || []).find(t => t.key === "HEX" || t.symbol === "HEX")?.address;
    if (!hexAddr) throw new Error("config.js에 HEX 주소가 없습니다");
    return new ethers.Contract(hexAddr, app.ERC20_ABI, ctx.signer);
  }

  async function refresh() {
    try {
      if (!window.Wallet || !Wallet.isConnected()) return;

      const ctx = await Wallet.getContext();
      const { address, chainId, gameRead } = ctx;

      if ($("wAddr")) $("wAddr").textContent = address;
      if ($("wNet")) $("wNet").textContent = chainId ? `chainId ${chainId}` : "-";

      const [u, power, cHex, taxPool, taxThreshold, pendingTimeout] = await Promise.all([
        gameRead.user(address),
        gameRead.dividendPower(address),
        gameRead.contractHexBalance(),
        gameRead.taxPool(),
        gameRead.taxThreshold(),
        gameRead.pendingTimeout(),
      ]);

      if ($("uDeposited")) $("uDeposited").innerHTML = `<span class="onchain">${compactNum(fmt18(u.deposited))} HEX</span>`;
      if ($("uTotalPaid")) $("uTotalPaid").innerHTML = `<span class="onchain">${compactNum(fmt18(u.totalPaid))} HEX</span>`;
      if ($("uPower")) $("uPower").innerHTML = `<span class="onchain-strong">${compactNum(fmt18(power))} HEX / day</span>`;

      if ($("uChampion")) $("uChampion").innerHTML = u.champion ? `<span class="onchain-strong">YES</span>` : `<span class="onchain">NO</span>`;
      if ($("uPending")) $("uPending").innerHTML = u.pendingGame ? `<span class="onchain-warn">YES</span>` : `<span class="onchain">NO</span>`;
      if ($("uPendingAt")) $("uPendingAt").textContent = fmtTime(u.pendingAt);

      if ($("uNum")) $("uNum").innerHTML = `<span class="onchain">${String(u.numerator)}</span>`;
      if ($("uDen")) $("uDen").innerHTML = `<span class="onchain">${String(u.denominator)}</span>`;

      if ($("cHex")) $("cHex").innerHTML = `<span class="onchain-strong">${compactNum(fmt18(cHex))} HEX</span>`;
      if ($("cTax")) $("cTax").innerHTML = `<span class="onchain-warn">${compactNum(fmt18(taxPool))} / ${compactNum(fmt18(taxThreshold))} HEX</span>`;
      if ($("cTimeout")) $("cTimeout").innerHTML = `<span class="onchain">${String(pendingTimeout)} sec</span>`;
    } catch (e) {
      console.error("[mypage] refresh error:", e);
    }
  }

  async function doDeposit() {
    const ctx = await getCtx();

    const input = $("depositAmount");
    if (!input) { alert("depositAmount input이 필요합니다"); return; }

    const v = String(input.value || "").trim();
    if (!v || Number(v) <= 0) { alert("기부할 HEX 수량을 입력하세요"); return; }

    const amount = ethers.parseUnits(v, 18);
    const hex = await getHexContract(ctx);

    // approve
    const allowance = await hex.allowance(ctx.address, window.APP.CONTRACT_ADDRESS);
    if (allowance < amount) {
      const tx1 = await hex.approve(window.APP.CONTRACT_ADDRESS, amount);
      await tx1.wait();
    }

    const tx2 = await ctx.game.deposit(amount);
    await tx2.wait();

    await refresh();
    Wallet.refreshTokenBar?.();
  }

  async function doClaim() {
    const ctx = await getCtx();
    const tx = await ctx.game.claim();
    await tx.wait();
    await refresh();
    Wallet.refreshTokenBar?.();
  }

  async function doJoinGame() {
    const ctx = await getCtx();
    const tx = await ctx.game.joinGame();
    await tx.wait();
    await refresh();
  }

  async function doSaveGame() {
    const ctx = await getCtx();

    const input = $("inScore");
    if (!input) { alert("inScore input이 필요합니다"); return; }

    const raw = String(input.value || "").trim();
    const score = parseInt(raw, 10);

    if (!Number.isFinite(score)) { alert("점수를 정수로 입력하세요"); return; }

    // ✅ 규칙: 100부터, 1:1 저장
    if (score < 100) { alert("점수는 100 이상부터 저장"); return; }

    const tx = await ctx.game.saveGame(score);
    await tx.wait();
    await refresh();
  }

  function bind() {
    $("btnDeposit")?.addEventListener("click", () => doDeposit().catch(e => alert(e?.message || "실패")));
    $("btnClaim")?.addEventListener("click", () => doClaim().catch(e => alert(e?.message || "실패")));
    $("btnJoin")?.addEventListener("click", () => doJoinGame().catch(e => alert(e?.message || "실패")));
    $("btnSave")?.addEventListener("click", () => doSaveGame().catch(e => alert(e?.message || "실패")));
  }

  window.addEventListener("wallet:connected", refresh);
  window.addEventListener("DOMContentLoaded", () => {
    bind();
    refresh();
    setInterval(refresh, 6000);
  });
})();
