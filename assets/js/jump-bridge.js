// /assets/js/jump-bridge.js
// 게임 페이지(breakout, tetris 등)에서 Jump 수탁지갑을 window.ethereum 처럼 사용하게 해주는 경량 브릿지.
// Firebase 없이 localStorage의 주소/토큰만으로 동작한다.
// Jump 세션(paw_jump_address)이 있으면 MetaMask보다 우선하여 Jump 심 설치.

(() => {
  const address = localStorage.getItem('paw_jump_address');
  if (!address) {
    console.warn('[Jump Bridge] paw_jump_address 없음 — offchain 페이지에서 Google 로그인 후 다시 시도하세요');
    return;
  }
  console.log('[Jump Bridge] window.ethereum 설치:', address.slice(0, 10) + '...');

  const JUMP_API = 'https://us-central1-jumper-b15aa.cloudfunctions.net/externalApi';
  const JUMP_KEY = '3fd9afc326ff3f687197f3fbc8f746133d513e5f3237a54a94cd87a3dd3b56cf';

  async function signMessage(message) {
    const token = localStorage.getItem('paw_jump_token');
    if (!token) throw new Error('Jump 토큰 없음 — 메인 사이트에서 다시 Google 로그인 하세요');
    const res = await fetch(JUMP_API + '/signMessage', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ userToken: token, message, apiKey: JUMP_KEY }),
    });
    if (!res.ok) throw new Error('Jump 서명 실패: ' + res.status);
    const data = await res.json();
    const sig = data.data?.signature || data.signature;
    if (!sig) throw new Error('서명 없음: ' + JSON.stringify(data));
    return sig;
  }

  // 게임 파일의 personal_sign 폴백용 전역 노출
  window.jumpAddress = address;
  window.jumpSign    = signMessage;

  window.ethereum = {
    isJumpWallet: true,
    selectedAddress: address,
    request: async ({ method, params = [] }) => {
      if (method === 'eth_requestAccounts' || method === 'eth_accounts')
        return [address];
      if (method === 'personal_sign')
        return signMessage(params[0]);
      if (method === 'eth_chainId')  return '0xCC';
      if (method === 'net_version')  return '204';
      if (method === 'wallet_switchEthereumChain' || method === 'wallet_addEthereumChain')
        return null;
      throw new Error('Jump bridge: 미지원 method - ' + method);
    },
    on() {}, removeListener() {}, off() {},
  };
})();
