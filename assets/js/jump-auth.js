// /assets/js/jump-auth.js
// Jump 수탁지갑 × Google 로그인 연동

(() => {
  if (window.JumpAuth) return;

  const JUMP_API = 'https://us-central1-jumper-b15aa.cloudfunctions.net/externalApi';
  const JUMP_KEY = '3fd9afc326ff3f687197f3fbc8f746133d513e5f3237a54a94cd87a3dd3b56cf';

  const FB_CFG = {
    apiKey:            'AIzaSyD6oGXWcQIAa46ZiO6E9fBWOXqiNCAL4-c',
    authDomain:        'jumper-b15aa.firebaseapp.com',
    projectId:         'jumper-b15aa',
    storageBucket:     'jumper-b15aa.firebasestorage.app',
    messagingSenderId: '1051842479371',
    appId:             '1:1051842479371:web:cd0dca2c1eab0e44b58e0e',
    measurementId:     'G-0EGPWQ3JP0',
  };

  let _user    = null;
  let _address = null;

  function isLoggedIn() { return !!_address; }
  function getAddress()  { return _address; }

  async function getIdToken() {
    if (!_user) throw new Error('Jump 로그인이 필요합니다');
    return _user.getIdToken(true); // 항상 최신 토큰 반환
  }

  async function login() {
    if (!window.firebase) throw new Error('Firebase SDK가 로드되지 않았습니다');
    if (!firebase.apps.length) firebase.initializeApp(FB_CFG);

    const provider = new firebase.auth.GoogleAuthProvider();
    const result   = await firebase.auth().signInWithPopup(provider);
    _user = result.user;

    const idToken = await _user.getIdToken();
    const res = await fetch(JUMP_API + '/verifyUser', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ userToken: idToken, apiKey: JUMP_KEY }),
    });
    if (!res.ok) throw new Error('Jump 서버 오류: ' + res.status);

    const data = await res.json();
    if (!data.data?.walletAddress) throw new Error('지갑 주소 없음: ' + JSON.stringify(data));

    _address = data.data.walletAddress;
    // 게임 페이지(jump-bridge.js)가 읽을 수 있도록 localStorage에 저장
    localStorage.setItem('paw_jump_address', _address);
    localStorage.setItem('paw_jump_token',   idToken);
    _installShim(); // window.ethereum 심 설치

    return { address: _address, email: data.data.email, name: data.data.name };
  }

  async function signMessage(message) {
    const idToken = await getIdToken();
    const res = await fetch(JUMP_API + '/signMessage', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ userToken: idToken, message, apiKey: JUMP_KEY }),
    });
    if (!res.ok) throw new Error('서명 실패: ' + res.status);
    const data = await res.json();
    const sig = data.data?.signature || data.signature;
    if (!sig) throw new Error('서명 없음: ' + JSON.stringify(data));
    return sig;
  }

  async function sendTransaction(to, abiFragment, method, args) {
    const idToken  = await getIdToken();
    const payload  = {
      idToken,
      apiKey: JUMP_KEY,
      tx: { type: 'contract', to, abi: [abiFragment], method, args: args.map(String) },
    };
    console.debug('[Jump] signTransaction →', JSON.stringify(payload.tx));

    const res = await fetch(JUMP_API + '/signTransaction', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': JUMP_KEY },
      body:    JSON.stringify(payload),
    });

    // HTTP 에러: 응답 본문에서 실제 메시지 추출
    if (!res.ok) {
      let msg = `signTransaction HTTP ${res.status}`;
      try {
        const errBody = await res.json();
        msg += ': ' + (errBody.error || errBody.message || JSON.stringify(errBody));
      } catch { /* body가 JSON이 아닌 경우 */ }
      console.error('[Jump] 오류:', msg);
      throw new Error(msg);
    }

    const result = await res.json();
    console.debug('[Jump] 응답:', result);
    if (!result.ok) throw new Error(result.error || '트랜잭션 실패');
    return result.data?.txHash || result.txHash;
  }

  // game 파일의 window.ethereum.request({ method:'personal_sign' }) 지원
  function _installShim() {
    window.ethereum = {
      isJumpWallet: true,
      get selectedAddress() { return _address; },
      request: async ({ method, params = [] }) => {
        if (method === 'eth_requestAccounts' || method === 'eth_accounts')
          return _address ? [_address] : [];
        if (method === 'personal_sign')
          return signMessage(params[0]);
        if (method === 'eth_chainId')  return '0xCC'; // opBNB
        if (method === 'net_version')  return '204';
        if (method === 'wallet_switchEthereumChain' || method === 'wallet_addEthereumChain')
          return null;
        throw new Error('Jump wallet: 미지원 method - ' + method);
      },
      on() {}, removeListener() {}, off() {},
    };
  }

  // 페이지 로드 시 이전 로그인 세션 자동 복원 (localStorage 기반)
  function _tryRestoreSession() {
    const addr  = localStorage.getItem('paw_jump_address');
    const token = localStorage.getItem('paw_jump_token');
    if (!addr || !token) return;
    _address = addr;
    // 저장된 토큰으로 임시 _user 생성 (Firebase 없이 동작)
    _user = { getIdToken: () => Promise.resolve(token) };
    _installShim();
  }
  _tryRestoreSession();

  window.JumpAuth = { isLoggedIn, getAddress, getIdToken, login, signMessage, sendTransaction };
})();
