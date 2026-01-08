// /assets/js/pages/index.js
(() => {
  const ethers = window.ethers;
  const $ = (id) => document.getElementById(id);

  function shortAddr(a){
    if(!a) return "-";
    return a.slice(0,6) + "..." + a.slice(-4);
  }

  function fmtTime(ts){
    const n = Number(ts);
    if (!n) return "-";
    return new Date(n * 1000).toLocaleString();
  }

  function compact(str){
    const n = Number(str);
    if (!Number.isFinite(n)) return str;
    if (n === 0) return "0";
    if (n >= 1e9) return (n/1e9).toFixed(2) + "B";
    if (n >= 1e6) return (n/1e6).toFixed(2) + "M";
    if (n >= 1e3) return (n/1e3).toFixed(2) + "K";
    if (n >= 100) return n.toFixed(2);
    if (n >= 1) return n.toFixed(4);
    return n.toFixed(6);
  }

  async function getNetLabel(chainId){
    if (!chainId) return "-";
    if (chainId === 204) return "opBNB (204)";
    if (chainId === 56) return "BSC (56)";
    return "chain " + chainId;
  }

  async function refresh(){
    const w = window.__WALLET__;
    const app = window.APP;
    if (!w || !w.signer || !w.account || !app) return;

    $("wAddr") && ($("wAddr").textContent = shortAddr(w.account));
    $("wNet") && ($("wNet").textContent = await getNetLabel(w.chainId));

    const game = new ethers.Contract(app.CONTRACT_ADDRESS, app.DIVIDENDGAME_ABI, w.signer);

    const u = await game.user(w.account);

    const deposited   = u[0];
    const totalPaid   = u[1];
    const lastClaimAt = u[2];
    const champion    = u[3];
    const pendingGame = u[4];
    const pendingAt   = u[5];
    const numerator   = u[6];
    const denominator = u[7];

    $("uDeposited") && ($("uDeposited").textContent = compact(ethers.formatUnits(deposited, 18)) + " HEX");
    $("uTotalPaid") && ($("uTotalPaid").textContent = compact(ethers.formatUnits(totalPaid, 18)) + " HEX");

    const power = await game.dividendPower(w.account);
    $("uPower") && ($("uPower").textContent = compact(ethers.formatUnits(power, 18)) + " HEX / day");

    $("uChampion") && ($("uChampion").textContent = champion ? "YES" : "NO");
    $("uPending") && ($("uPending").textContent = pendingGame ? "YES" : "NO");
    $("uPendingAt") && ($("uPendingAt").textContent = fmtTime(pendingAt));

    $("uNum") && ($("uNum").textContent = String(numerator));
    $("uDen") && ($("uDen").textContent = String(denominator));

    const cHex = await game.contractHexBalance();
    $("cHex") && ($("cHex").textContent = compact(ethers.formatUnits(cHex, 18)) + " HEX");

    const [taxPool, taxThreshold, pendingTimeout] = await Promise.all([
      game.taxPool(),
      game.taxThreshold(),
      game.pendingTimeout(),
    ]);

    $("cTax") && ($("cTax").textContent =
      compact(ethers.formatUnits(taxPool, 18)) + " / " + compact(ethers.formatUnits(taxThreshold, 18)) + " HEX"
    );
    $("cTimeout") && ($("cTimeout").textContent = String(pendingTimeout) + " sec");

    // lastClaimAt 표시하고 싶으면 id 만들어서 넣으면 됨
    // console.log("lastClaimAt", lastClaimAt.toString());
  }

  window.addEventListener("wallet:connected", refresh);

  window.addEventListener("DOMContentLoaded", () => {
    if (window.__WALLET__ && window.__WALLET__.account) refresh();
  });

  setInterval(() => {
    if (window.__WALLET__ && window.__WALLET__.account) refresh();
  }, 6000);
})();
