// /assets/js/wallet.js
// - Wallet.connect() 제공
// - window.__WALLET__ (레거시 호환) 세팅
// - wallet:connected / wallet:disconnected 이벤트 발행
// - 헤더 토큰바 갱신

(() => {
  if (window.Wallet) return; // 중복 로드 방지

  const ethers = window.ethers;

  const OPBNB_CHAIN_ID = 204n; // opBNB mainnet
  const OPBNB_PARAMS = {
    chainId: "0xCC",
    chainName: "opBNB Mainnet",
    nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
    rpcUrls: ["https://opbnb-mainnet-rpc.bnbchain.org"],
    blockExplorerUrls: ["https://opbnbscan.com"],
  };

  function shortAddr(a) {
    if (!a) return "-";
    return a.slice(0, 6) + "..." + a.slice(-4);
  }

  function fmtUnits(raw, decimals) {
    try {
      return ethers.formatUnits(raw, decimals);
    } catch {
      return String(raw);
    }
  }

  // 18dec 전용(게임 HEX 표시용)
  function fmt18(raw) {
    return fmtUnits(raw, 18);
  }

  async function ensureOpBNB(provider) {
    const net = await provider.getNetwork();
    if (net.chainId === OPBNB_CHAIN_ID) return;

    const ethereum = window.ethereum;
    if (!ethereum) throw new Error("지갑이 없습니다");

    try {
      await ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: OPBNB_PARAMS.chainId }],
      });
    } catch (e) {
      if (e && (e.code === 4902 || String(e.message || "").includes("4902"))) {
        await ethereum.request({
          method: "wallet_addEthereumChain",
          params: [OPBNB_PARAMS],
        });
      } else {
        throw new Error("네트워크를 opBNB로 바꿔주세요");
      }
    }
  }

  const state = {
    provider: null,
    signer: null,
    address: null,
    chainId: null,

    game: null,      // signer (write)
    gameRead: null,  // rpc (read)

    tokenRead: new Map(), // symbol -> contract(read)
    readProvider: null,
  };

  async function buildContracts() {
    const APP = window.APP;
    if (!APP) throw new Error("config.js(window.APP)가 먼저 필요합니다");

    state.readProvider = new ethers.JsonRpcProvider(APP.RPC_URL);

    state.gameRead = new ethers.Contract(
      APP.CONTRACT_ADDRESS,
      APP.DIVIDENDGAME_ABI,
      state.readProvider
    );

    state.tokenRead.clear();
    for (const t of APP.TOKENS || []) {
      if (!t.address) continue;
      state.tokenRead.set(
        t.symbol,
        new ethers.Contract(t.address, APP.ERC20_ABI, state.readProvider)
      );
    }
  }

  function renderWalletText() {
    const wAddr = document.getElementById("wAddr");
    if (wAddr) wAddr.textContent = state.address ? shortAddr(state.address) : "-";

    const wNet = document.getElementById("wNet");
    if (wNet) wNet.textContent = state.chainId ? `chainId ${state.chainId}` : "-";

    const netBadge = document.getElementById("netBadge");
    if (netBadge) netBadge.textContent = state.chainId ? `opBNB (${state.chainId})` : "-";
  }

  function setLegacyWallet() {
    // 기존 pages/* 에서 쓰는 window.__WALLET__ 호환
    if (!state.provider || !state.signer || !state.address) {
      window.__WALLET__ = null;
      return;
    }
    window.__WALLET__ = {
      provider: state.provider,
      signer: state.signer,
      account: state.address,
      chainId: state.chainId,
    };
  }

  function emit(name, detail) {
    window.dispatchEvent(new CustomEvent(name, { detail }));
  }

  function resetConnection() {
    state.provider = null;
    state.signer = null;
    state.address = null;
    state.chainId = null;
    state.game = null;

    setLegacyWallet();
    renderWalletText();
    refreshTokenBar().catch(() => {});
    emit("wallet:disconnected");
  }

  async function connect() {
    const APP = window.APP;
    if (!APP) throw new Error("config.js(window.APP)가 먼저 필요합니다");

    const ethereum = window.ethereum;
    if (!ethereum) throw new Error("메타마스크(또는 Rabby) 지갑이 필요합니다");

    if (!state.gameRead || !state.readProvider) {
      await buildContracts();
    }

    const provider = new ethers.BrowserProvider(ethereum);

    await ensureOpBNB(provider);
    await provider.send("eth_requestAccounts", []);

    const signer = await provider.getSigner();
    const address = await signer.getAddress();
    const net = await provider.getNetwork();

    state.provider = provider;
    state.signer = signer;
    state.address = address;
    state.chainId = net.chainId;

    state.game = new ethers.Contract(APP.CONTRACT_ADDRESS, APP.DIVIDENDGAME_ABI, signer);

    setLegacyWallet();
    renderWalletText();

    await refreshTokenBar();

    emit("wallet:connected", { address: state.address, chainId: state.chainId });

    return getContext();
  }

  function isConnected() {
    return !!state.address && !!state.signer && !!state.game;
  }

  async function getContext() {
    return {
      provider: state.provider,
      signer: state.signer,
      address: state.address,
      chainId: state.chainId,
      game: state.game,
      gameRead: state.gameRead,
      tokenRead: state.tokenRead,
      fmt18,
      shortAddr,
    };
  }

  async function requireConnected() {
    if (!isConnected()) throw new Error("지갑을 먼저 연결하세요");
    return getContext();
  }

  // 헤더 토큰바 갱신
  async function refreshTokenBar() {
    const APP = window.APP;
    if (!APP) return;

    const wrap = document.getElementById("tokenBar");
    const bar = document.getElementById("tokenBarInner");
    if (!wrap || !bar) return;

    if (!isConnected()) {
      wrap.style.display = "none";
      bar.innerHTML = "";
      return;
    }

    wrap.style.display = "block";

    // pill 생성
    if (!bar.dataset.ready) {
      bar.dataset.ready = "1";
      bar.innerHTML = "";
      for (const t of APP.TOKENS) {
        const el = document.createElement("div");
        el.className = "tok loading";
        el.id = `tok_${t.symbol}`;
        el.innerHTML = `<span class="s">${t.symbol}</span><span class="a">-</span>`;
        bar.appendChild(el);
      }
    }

    const addr = state.address;

    const results = await Promise.all(
      (APP.TOKENS || []).map(async (t) => {
        try {
          const c = state.tokenRead.get(t.symbol);
          if (!c) throw new Error("no token contract");

          // 여기서 BAD_DATA(0x) 나오면: opBNB에 해당 주소 컨트랙트 코드가 없다는 뜻
          const bal = await c.balanceOf(addr);

          let decimals = 18;
          if (APP.ZERO_DECIMALS && APP.ZERO_DECIMALS.has(t.symbol)) {
            decimals = 0;
          } else {
            try {
              decimals = Number(await c.decimals());
            } catch {
              decimals = 18;
            }
          }

          return { symbol: t.symbol, text: fmtUnits(bal, decimals) };
        } catch (e) {
          return { symbol: t.symbol, text: "ERR" };
        }
      })
    );

    for (const r of results) {
      const el = document.getElementById(`tok_${r.symbol}`);
      if (!el) continue;
      el.classList.remove("loading");
      const a = el.querySelector(".a");
      if (a) a.textContent = r.text;
    }
  }

  // 체인/계정 변경 시 리셋
  function bindEvents() {
    const ethereum = window.ethereum;
    if (!ethereum) return;

    ethereum.on?.("accountsChanged", resetConnection);
    ethereum.on?.("chainChanged", resetConnection);
  }

  buildContracts().catch(() => {});
  bindEvents();

  window.Wallet = {
    connect,
    isConnected,
    getContext,
    requireConnected,
    refreshTokenBar,

    // util
    fmt18,
    shortAddr,
  };
})();
