// /assets/js/config.js
(() => {
  // opBNB mainnet RPC
  const RPC_URL = "https://opbnb-mainnet-rpc.bnbchain.org";

  // DividendGame 배포 주소
  const CONTRACT_ADDRESS = "0xe05577473f3ddacB1ad37621A3508063dbD62799";

  // 토큰 주소
  const TOKENS = [
    { key: "USDT", symbol: "USDT", address: "0x9e5aac1ba1a2e6aed6b32689dfcf62a509ca96f3" },
    { key: "HEX",  symbol: "HEX",  address: "0x41F2Ea9F4eF7c4E35ba1a8438fC80937eD4E5464" },
    { key: "HUT",  symbol: "HUT",  address: "0x3e31344335C77dA37cb2Cf409117e1dCa5Fda634" },
    { key: "PUT",  symbol: "PUT",  address: "0xE0fD5e1C6D832E71787BfB3E3F5cdB5dd2FD41b6" },
    { key: "BUT",  symbol: "BUT",  address: "0xc159663b769E6c421854E913460b973899B76E42" },
    { key: "VET",  symbol: "VET",  address: "0xff8eCA08F731EAe46b5e7d10eBF640A8Ca7BA3D4" },
    { key: "EXP",  symbol: "EXP",  address: "0xBc619cb03c0429731AF66Ae8ccD5aeE917A6E5f4" },
  ];

  // PUT, BUT, EXP, VET, HUT 는 0 decimals
  const ZERO_DECIMALS = new Set(["HUT", "PUT", "BUT", "VET", "EXP"]);

  // DividendGame ABI (프론트에서 쓰는 함수만)
  const DIVIDENDGAME_ABI = [
    "function deposit(uint256 amount) external",
    "function claim() external",
    "function joinGame() external",
    "function saveGame(uint256 gameScore) external",
    "function dividendPower(address a) view returns (uint256)",
    "function contractHexBalance() view returns (uint256)",
    "function taxPool() view returns (uint256)",
    "function taxThreshold() view returns (uint256)",
    "function pendingTimeout() view returns (uint256)",
    "function user(address) view returns (uint256 deposited,uint256 totalPaid,uint256 lastClaimAt,bool champion,bool pendingGame,uint256 pendingAt,uint256 numerator,uint256 denominator)"
  ];

  // ERC20 공통 ABI
  const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
  ];

  // 유틸: 0주소 판별
  function isZeroAddr(a){
    return !a || a.toLowerCase() === "0x0000000000000000000000000000000000000000";
  }

  // 유틸: 토큰 목록(0주소 제거된 표시용)
  const TOKENS_VISIBLE = TOKENS.filter(t => !isZeroAddr(t.address));

  window.APP = {
    RPC_URL,
    CONTRACT_ADDRESS,
    TOKENS,
    TOKENS_VISIBLE,
    ZERO_DECIMALS,
    DIVIDENDGAME_ABI,
    ERC20_ABI
  };
})();
