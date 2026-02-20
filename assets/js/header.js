// /assets/js/header.js
(() => {
  if (window.__HEADER_INIT__) return;
  window.__HEADER_INIT__ = true;

  function qs(id) { return document.getElementById(id); }

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

    // 지갑 연결 버튼
    btnConnect.addEventListener('click', async () => {
      try {
        btnConnect.textContent = '연결중...';
        btnConnect.disabled = true;
        await Wallet.connect();
        btnConnect.textContent = '연결됨';
      } catch (e) {
        btnConnect.textContent = '지갑연결';
        alert(e?.shortMessage || e?.message || '지갑 연결 실패');
      } finally {
        btnConnect.disabled = false;
      }
    });

    // 이미 연결돼 있으면 토큰바 반영
    setTimeout(() => { Wallet.refreshTokenBar?.(); }, 50);

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
    if (btn) btn.textContent = '연결됨';
  });
  window.addEventListener('wallet:disconnected', () => {
    const btn = qs('btnConnect');
    if (btn) btn.textContent = '지갑연결';
  });
})();
