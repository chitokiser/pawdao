// /assets/js/header.js
(() => {
  if (window.__HEADER_INIT__) return;
  window.__HEADER_INIT__ = true;

  function qs(id) { return document.getElementById(id); }

  /* ── 토스트 상태 알림 ─────────────────────────────────────── */
  let _toastTimer = null;

  function getToast() {
    let el = document.getElementById('statusToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'statusToast';
      el.innerHTML = '<span class="toast-icon"></span><span class="toast-msg"></span>';
      document.body.appendChild(el);
    }
    return el;
  }

  function showToast(type, msg, autoDismiss = 0) {
    const el   = getToast();
    const icon = el.querySelector('.toast-icon');
    const txt  = el.querySelector('.toast-msg');

    el.className = '';
    if (type === 'loading') { el.classList.add('toast-loading'); icon.textContent = '⏳'; }
    else if (type === 'ok') { el.classList.add('toast-ok');      icon.textContent = '✓'; }
    else                    { el.classList.add('toast-err');     icon.textContent = '✕'; }

    txt.textContent = msg;
    el.classList.add('show');

    if (_toastTimer) clearTimeout(_toastTimer);
    if (autoDismiss > 0) {
      _toastTimer = setTimeout(() => { el.classList.remove('show'); }, autoDismiss);
    }
  }

  function hideToast() {
    if (_toastTimer) clearTimeout(_toastTimer);
    const el = document.getElementById('statusToast');
    if (el) el.classList.remove('show');
  }

  // 다른 파일(wallet.js, mypage.js)에서 사용할 수 있도록 전역 노출
  window.showToast = showToast;
  window.hideToast = hideToast;

  /* ── 드롭다운 열기/닫기 ──────────────────────────────────── */
  function openNav(open) {
    const body    = document.body;
    const burger  = qs('btnBurger');

    if (open) {
      body.classList.add('nav-open');
      if (burger) burger.setAttribute('aria-expanded', 'true');
    } else {
      body.classList.remove('nav-open');
      if (burger) burger.setAttribute('aria-expanded', 'false');
    }
  }

  function toggleNav() {
    openNav(!document.body.classList.contains('nav-open'));
  }

  /* ── 헤더 바인딩 ─────────────────────────────────────────── */
  function bindHeaderOnce() {
    const btnBurger   = qs('btnBurger');
    const navBackdrop = qs('navBackdrop');
    const navDrawer   = qs('navDrawer');
    const btnConnect  = qs('btnConnect');
    const btnGoogle   = qs('btnGoogle');

    if (!btnConnect || !btnBurger || !navBackdrop || !navDrawer) return false;

    // 햄버거 토글
    btnBurger.addEventListener('click', toggleNav);

    // 배경 클릭 → 닫기
    navBackdrop.addEventListener('click', () => openNav(false));

    // 드롭다운 안 링크 클릭 → 닫기
    navDrawer.addEventListener('click', (e) => {
      if (e.target?.closest?.('a')) openNav(false);
    });

    // ESC 키 → 닫기
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') openNav(false);
    });

    // 지갑 연결 버튼 (MetaMask / Rabby)
    btnConnect.addEventListener('click', async () => {
      try {
        btnConnect.textContent = '연결중...';
        btnConnect.disabled = true;
        showToast('loading', '지갑 연결 중...');
        await Wallet.connect();
        btnConnect.textContent = '연결됨';
        showToast('ok', '지갑이 연결됐습니다', 3000);
      } catch (e) {
        btnConnect.textContent = '지갑연결';
        const msg = e?.shortMessage || e?.message || '지갑 연결 실패';
        showToast('err', msg, 5000);
      } finally {
        btnConnect.disabled = false;
      }
    });

    // Google 로그인 버튼 (Jump 수탁지갑)
    if (btnGoogle) {
      btnGoogle.addEventListener('click', async () => {
        try {
          btnGoogle.textContent = '로그인중...';
          btnGoogle.disabled = true;
          showToast('loading', 'Google 로그인 중...');
          await Wallet.connectWithJump();
          btnGoogle.textContent = 'Google 연결됨';
          showToast('ok', 'Google 로그인 완료', 3000);
        } catch (e) {
          btnGoogle.textContent = 'Google 로그인';
          showToast('err', e?.message || 'Google 로그인 실패', 5000);
        } finally {
          btnGoogle.disabled = false;
        }
      });
    }

    // 이미 연결돼 있으면 토큰바 반영
    setTimeout(() => { Wallet.refreshTokenBar?.(); }, 50);

    // Jump 세션이 복원되어 있으면 자동으로 wallet 연결 (버튼 클릭 불필요)
    if (window.JumpAuth?.isLoggedIn() && window.Wallet?.connectWithJump) {
      Wallet.connectWithJump().then(() => {
        const btnG = qs('btnGoogle');
        if (btnG) btnG.textContent = 'Google 연결됨';
      }).catch(() => { /* 조용히 실패 - 토큰 만료 시 버튼으로 재로그인 */ });
    }

    return true;
  }

  /* ── 파셜 주입 타이밍 대응: 반복 체크 ───────────────────── */
  function boot() {
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (bindHeaderOnce()) {
        clearInterval(t);
      } else if (tries > 60) {
        clearInterval(t);
      }
    }, 50);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* ── 지갑 연결/해제 이벤트 ───────────────────────────────── */
  window.addEventListener('wallet:connected', () => {
    const btn = qs('btnConnect');
    const btnG = qs('btnGoogle');
    if (btn) btn.textContent = '연결됨';
    if (btnG && window.JumpAuth?.isLoggedIn()) btnG.textContent = 'Google 연결됨';
  });
  window.addEventListener('wallet:disconnected', () => {
    const btn = qs('btnConnect');
    const btnG = qs('btnGoogle');
    if (btn) btn.textContent = '지갑연결';
    if (btnG) btnG.textContent = 'Google 로그인';
  });
})();
