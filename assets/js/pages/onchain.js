// /assets/js/pages/onchain.js
(() => {
  const $ = (id) => document.getElementById(id);

  // 18 decimals 표기 (HEX 용)
  function fmt18(v) {
    try {
      return window.ethers.formatUnits(v, 18);
    } catch {
      return String(v);
    }
  }

  async function refresh() {
    try {
      // 지갑이 아직 연결 안됐으면 조용히 종료
      if (!Wallet.isConnected()) return;

      const ctx = await Wallet.getContext();
      const addr = ctx.address;
      if (!addr) return;

      // view 함수는 read 컨트랙트로 호출 (가벼움/안전)
      const gameRead = ctx.gameRead;

      const [info, power] = await Promise.all([
        gameRead.user(addr),
        gameRead.dividendPower(addr),
      ]);

      const elAddr = $("wAddr");
      if (elAddr) elAddr.textContent = addr;

      const elDep = $("uDeposited");
      if (elDep) elDep.textContent = fmt18(info.deposited);

      const elNum = $("uNum");
      if (elNum) elNum.textContent = String(info.numerator);

      const elDen = $("uDen");
      if (elDen) elDen.textContent = String(info.denominator);

      const elPower = $("uPower");
      if (elPower) elPower.textContent = fmt18(power);
    } catch (e) {
      console.error("[onchain.js] refresh error:", e);
    }
  }

  // wallet.js가 connect 성공 후 UI 갱신하면, 우리도 갱신
  window.addEventListener("wallet:connected", refresh);

  // 페이지 진입 후에도 한번 갱신 시도
  document.addEventListener("DOMContentLoaded", refresh);

  // 주기적 갱신
  setInterval(refresh, 5000);
})();
