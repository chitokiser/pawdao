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

  // ── Jump 수탁지갑 Signer (ethers v6 AbstractSigner 구현) ────────────────────
  class JumpSigner extends ethers.AbstractSigner {
    constructor(address, provider, jumpAuth, contractAddress) {
      super(provider);
      this._address         = address;
      this._jump            = jumpAuth;
      this._contractAddress = contractAddress;
      this._iface           = null;
    }

    async getAddress() { return this._address; }

    connect(provider) {
      const s = new JumpSigner(this._address, provider, this._jump, this._contractAddress);
      s._iface = this._iface;
      return s;
    }

    async signMessage(message) {
      const msg = typeof message === 'string' ? message : ethers.toUtf8String(message);
      return this._jump.signMessage(msg);
    }

    async signTransaction() { throw new Error('signTransaction 미지원'); }
    async signTypedData()   { throw new Error('signTypedData 미지원'); }

    _getIface() {
      if (!this._iface) {
        const APP = window.APP;
        // 게임 컨트랙트 ABI + ERC20 ABI 통합 (approve 등 ERC20 함수 디코딩 포함)
        const combined = [
          ...(APP.DIVIDENDGAME_ABI || []),
          ...(APP.ERC20_ABI        || []),
        ];
        this._iface = new ethers.Interface(combined);
      }
      return this._iface;
    }

    async sendTransaction(tx) {
      const iface   = this._getIface();
      const decoded = iface.parseTransaction({ data: tx.data });
      if (!decoded) throw new Error('Jump: calldata 디코딩 실패');

      const abiFragment = decoded.fragment.format('minimal'); // "function approve(address,uint256) returns (bool)"
      const args        = [...decoded.args].map(a => a.toString());
      const to          = tx.to ? tx.to.toString() : this._contractAddress;

      const toast = (t, m) => window.showToast?.(t, m);

      // ALLOW 에러 시 Jump 노드 상태 동기화 대기 후 재시도 (최대 5회, 간격 8초)
      const MAX_ALLOW_RETRY = 5;
      let txHash;
      for (let attempt = 0; attempt < MAX_ALLOW_RETRY; attempt++) {
        toast('loading', `[${decoded.name}] Jump 서명 요청 중...`);
        try {
          txHash = await this._jump.sendTransaction(to, abiFragment, decoded.name, args);
          break;
        } catch (e) {
          const msg = e.message || '';
          // "already known" = 동일 트랜잭션이 이미 mempool에 있음 → 이전 세션의 미체결 tx
          if (msg.includes('already known')) {
            throw new Error('이전 트랜잭션이 처리 중입니다. 약 30초 후 다시 시도하세요.');
          }
          // "ALLOW" revert만 재시도 (approve→deposit 사이 Jump 노드 sync 지연)
          // estimateGas는 너무 광범위해서 joinGame 등 정상 에러도 재시도됨 → 제거
          if (attempt < MAX_ALLOW_RETRY - 1 && msg.includes('ALLOW')) {
            const delaySec = 8;
            const nth = `${attempt + 1}/${MAX_ALLOW_RETRY - 1}`;
            console.warn(`[Jump] ALLOW 에러, ${delaySec}000ms 후 재시도 (${nth})...`);
            toast('loading', `[${decoded.name}] ALLOW 에러 · Jump 노드 동기화 대기 중... 재시도 ${nth}`);
            await new Promise(r => setTimeout(r, delaySec * 1000));
            continue;
          }
          throw e;
        }
      }

      const provider = this.provider;

      return {
        hash: txHash,
        from: this._address,
        wait: async () => {
          toast('loading', `[${decoded.name}] 블록 채굴 대기 중...`);
          for (let i = 0; i < 30; i++) {
            await new Promise(r => setTimeout(r, 2000));
            try {
              const receipt = await provider.getTransactionReceipt(txHash);
              if (receipt) {
                if (receipt.status === 0) throw new Error('트랜잭션 revert: ' + txHash);
                // Jump 노드가 상태를 전파할 시간을 줌 (다음 tx의 가스 추정 오류 방지)
                toast('loading', `[${decoded.name}] 확인됨 · Jump 노드 동기화 중 (10초)...`);
                await new Promise(r => setTimeout(r, 10000));
                return receipt;
              }
            } catch (e) {
              if (e.message?.includes('revert') || e.message?.includes('실패')) throw e;
            }
          }
          throw new Error('영수증 조회 타임아웃: ' + txHash);
        },
      };
    }
  }

  // ── Jump 로그인으로 연결 ──────────────────────────────────────────────────────
  async function connectWithJump() {
    const APP = window.APP;
    if (!APP) throw new Error("config.js가 필요합니다");

    const JumpAuth = window.JumpAuth;
    if (!JumpAuth) throw new Error("jump-auth.js가 먼저 로드되어야 합니다");

    if (!JumpAuth.isLoggedIn()) {
      await JumpAuth.login();
    }

    if (!state.gameRead || !state.readProvider) {
      await buildContracts();
    }

    const address = JumpAuth.getAddress();
    const signer  = new JumpSigner(address, state.readProvider, JumpAuth, APP.CONTRACT_ADDRESS);

    state.provider = state.readProvider;
    state.signer   = signer;
    state.address  = address;
    state.chainId  = OPBNB_CHAIN_ID;
    state.game     = new ethers.Contract(APP.CONTRACT_ADDRESS, APP.DIVIDENDGAME_ABI, signer);

    setLegacyWallet();
    renderWalletText();
    await refreshTokenBar();

    emit("wallet:connected", { address, chainId: OPBNB_CHAIN_ID });
    return getContext();
  }

  // ── MetaMask / Rabby 연결 ─────────────────────────────────────────────────────
  async function connect() {
    const APP = window.APP;
    if (!APP) throw new Error("config.js(window.APP)가 먼저 필요합니다");

    // Jump 심이 설치돼 있으면 Jump 경로로 처리
    if (window.ethereum?.isJumpWallet) return connectWithJump();

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

    const wrap = document.getElementById("hdrTokenWrap");
    const bar = document.getElementById("hdrTokenBar");
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
    connectWithJump,
    isConnected,
    getContext,
    requireConnected,
    refreshTokenBar,

    // util
    fmt18,
    shortAddr,
  };
})();
