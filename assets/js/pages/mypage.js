// /assets/js/pages/mypage.js
(() => {
  const ethers = window.ethers;
  const $ = (id) => document.getElementById(id);

  const DAY = 24 * 3600;
  let _lastClaimAt = 0;

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

  function fmtRemaining(sec) {
    const s = Number(sec) || 0;
    if (s <= 0) return "0s";
    const days = Math.floor(s / 86400);
    const hrs = Math.floor((s % 86400) / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = Math.floor(s % 60);
    if (days > 0) return `${days}d ${hrs}h ${String(mins).padStart(2,'0')}m ${String(secs).padStart(2,'0')}s`;
    return `${String(hrs).padStart(2,'0')}:${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}`;
  }

  function fmt18(v) {
    try { return ethers.formatUnits(v, 18); }
    catch { return String(v); }
  }

  const HELP_TEXT = {
    pending: '<div>유저가 게임에 참여하려고 <code>joinGame()</code>를 호출하면 설정되는 플래그입니다. pending 상태에서는 점수 제출을 기다리며, <code>saveGame()</code>로 점수를 저장하거나 타임아웃이 지나면 자동 해제됩니다.</div>',
    pendingAt: '<div>pending 상태로 들어간 시작 시각입니다. 타임아웃 계산의 기준이 됩니다.</div>',
    timeout: '<div>pending 상태가 유지되는 최대 시간(초)입니다. 이 시간이 지나면 서버(컨트랙트)가 자동으로 pending을 해제합니다.</div>',
    numerator: '<div>게임 점수(분자)로 사용되는 개인 값입니다. 게임 참여/저장에 따라 변경됩니다.</div>',
    denominator: '<div>분모 값입니다. 분자/분모 비율은 배당파워 계산에 사용됩니다.</div>',
    power: '<div>현재 계정의 배당 파워(1일 기준)입니다. 이 값이 실제 배당(지급 가능 금액)을 결정합니다.</div>',
  };

  function openHelp(key, data = {}) {
    const overlay = $("pendingModalOverlay");
    const modal = $("pendingModal");
    const content = $("pendingModalContent");
    if (!overlay || !modal || !content) return;
    let html = HELP_TEXT[key] || '<div>설명 없음</div>';
    // dynamic augmentation for pending key
    if (key === 'pending' || key === 'pendingAt') {
      const pa = Number(data.pa) || 0;
      const pendingTimeoutSec = Number(data.pendingTimeoutSec) || 0;
      const now = Math.floor(Date.now() / 1000);
      const rem = pa ? Math.max(0, (pa + pendingTimeoutSec) - now) : 0;
      html = `
        <div style="font-weight:600;margin-bottom:6px;">pending 상태 정보</div>
        <div>시작: ${pa ? fmtTime(pa) : '-'}</div>
        <div>남은시간: ${fmtRemaining(rem)}</div>
        <div>타임아웃: ${pendingTimeoutSec}초</div>
        <div style="margin-top:8px;font-size:13px;color:#333">설명: 사용자가 <code>joinGame()</code> 호출로 게임에 참여하면 설정됩니다. 점수 제출 시 <code>saveGame()</code>로 해제되며, 지정된 타임아웃이 지나면 자동으로 해제됩니다.</div>
      `;
    }
    content.innerHTML = html;
    overlay.style.display = 'block';
    modal.style.display = 'block';
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

  function getGameAddress(ctx) {
    const a = ctx?.game?.target || window.APP?.CONTRACT_ADDRESS;
    if (!a) throw new Error("컨트랙트 주소(APP.CONTRACT_ADDRESS)가 없습니다");
    return a;
  }

  async function refresh() {
    try {
      if (!window.Wallet || !Wallet.isConnected()) return;

      const ctx = await Wallet.getContext();
      const { address, chainId, gameRead } = ctx;

      if ($("wAddr")) $("wAddr").textContent = address;
      if ($("wNet")) $("wNet").textContent = chainId ? `chainId ${chainId}` : "-";

      const hex = await getHexContract(ctx);

      const [
        u,
        power,
        cHex,
        taxPool,
        taxThreshold,
        pendingTimeout,
        myHexBal,
      ] = await Promise.all([
        gameRead.user(address),
        gameRead.dividendPower(address),
        gameRead.contractHexBalance(),
        gameRead.taxPool(),
        gameRead.taxThreshold(),
        gameRead.pendingTimeout(),
        hex.balanceOf(address),
      ]);

      if ($("hexBal")) $("hexBal").textContent = `${compactNum(fmt18(myHexBal))} HEX`;

      if ($("uDeposited")) $("uDeposited").textContent = `${compactNum(fmt18(u.deposited))} HEX`;
      if ($("uTotalPaid")) $("uTotalPaid").textContent = `${compactNum(fmt18(u.totalPaid))} HEX`;
      if ($("uPower")) $("uPower").textContent = `${compactNum(fmt18(power))} HEX / day`;

      // show estimated per-claim amount (after 10% tax)
      if ($("claimHint")) {
        try {
          const grossBn = (typeof power === 'bigint') ? power : BigInt(String(power || 0));
          const taxBn = grossBn / 10n;
          const netBn = grossBn - taxBn;
          $("claimHint").textContent = `${compactNum(fmt18(netBn))} HEX`;
        } catch (e) {
          $("claimHint").textContent = `${compactNum(fmt18(power))} HEX`;
        }
      }

      if ($("uChampion")) $("uChampion").textContent = u.champion ? "YES" : "NO";
      if ($("uPending")) $("uPending").textContent = u.pendingGame ? "YES" : "NO";

      // pendingAt display + modal content
      const uPendingEl = $("uPendingAt");
      const modalContent = $("pendingModalContent");
      const modal = $("pendingModal");
      const overlay = $("pendingModalOverlay");
      const modalClose = $("pendingModalClose");
      const hintBtn = $("pendingHintBtn");
      const nowSec = Math.floor(Date.now() / 1000);
      const pa = Number(u.pendingAt) || 0;
      if (uPendingEl) {
        uPendingEl.textContent = pa ? fmtTime(pa) : "Not pending";
        try { uPendingEl.dataset.ts = String(pa); } catch(_){}
      }
      // store pendingTimeout globally so help buttons can access latest value
      try { window._pendingTimeout = Number(pendingTimeout) || 0; } catch(_){}
      // prepare modal content for pending (used by help btn)
      const pendingTimeoutSec = Number(pendingTimeout) || 0;
      if (hintBtn) {
        hintBtn.onclick = (e) => {
          e.preventDefault();
          openHelp('pending', { pa, pendingTimeoutSec });
        };
      }
      if (modalClose) {
        modalClose.onclick = () => {
          if (overlay) overlay.style.display = 'none';
          if (modal) modal.style.display = 'none';
        };
      }
      if (overlay) {
        overlay.onclick = () => {
          if (overlay) overlay.style.display = 'none';
          if (modal) modal.style.display = 'none';
        };
      }

      // track lastClaimAt and display remaining time until next claim
      _lastClaimAt = Number(u.lastClaimAt) || 0;
      if ($("nextClaim")) {
        const now = Math.floor(Date.now() / 1000);
        const rem = Math.max(0, (_lastClaimAt + DAY) - now);
        $("nextClaim").textContent = fmtRemaining(rem);
      }

      if ($("uNum")) $("uNum").textContent = String(u.numerator);
      if ($("uDen")) $("uDen").textContent = String(u.denominator);

      if ($("cHex")) $("cHex").textContent = `${compactNum(fmt18(cHex))} HEX`;
      if ($("cTax")) $("cTax").textContent = `${compactNum(fmt18(taxPool))} / ${compactNum(fmt18(taxThreshold))} HEX`;
      if ($("cTimeout")) $("cTimeout").textContent = String(pendingTimeout);

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
    const gameAddr = getGameAddress(ctx);

    const allowance = await hex.allowance(ctx.address, gameAddr);
    if (allowance < amount) {
      const tx1 = await hex.approve(gameAddr, amount);
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

  function bind() {
    $("btnDeposit")?.addEventListener("click", () => doDeposit().catch(e => alert(e?.message || "실패")));
    $("btnClaim")?.addEventListener("click", () => doClaim().catch(e => alert(e?.message || "실패")));
    // bind generic help buttons
    document.querySelectorAll('.helpBtn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const key = btn.dataset.help;
        // dynamic data for pending keys
        if (key === 'pending' || key === 'pendingAt') {
          const pa = Number(window.document.getElementById('uPendingAt')?.dataset.ts || 0) || 0;
          // pass values from latest refresh where possible
          openHelp(key, { pa, pendingTimeoutSec: Number(window._pendingTimeout || 0) });
        } else {
          openHelp(key, {});
        }
      });
    });
  }

  window.addEventListener("wallet:connected", refresh);
  window.addEventListener("DOMContentLoaded", () => {
    bind();
    refresh();
    setInterval(refresh, 6000);

    // update displayed countdown every second
    setInterval(() => {
      if (!$("nextClaim")) return;
      const now = Math.floor(Date.now() / 1000);
      const rem = Math.max(0, (_lastClaimAt + DAY) - now);
      $("nextClaim").textContent = fmtRemaining(rem);
    }, 1000);

    // close modal on Escape (single binding)
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const overlay = $("pendingModalOverlay");
      if (overlay && overlay.style.display === 'block') {
        $("pendingModalClose")?.click();
      }
    });
  });
})();
