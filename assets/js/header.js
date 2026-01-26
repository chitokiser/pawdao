// /assets/js/header.js
(() => {
  if (window.__HEADER_INIT__) return;
  window.__HEADER_INIT__ = true;

  function qs(id) { return document.getElementById(id); }

  function openNav(open) {
    const body = document.body;
    if (open) body.classList.add("nav-open");
    else body.classList.remove("nav-open");
  }

  function bindHeaderOnce() {
    const btnBurger = qs("btnBurger");
    const navBackdrop = qs("navBackdrop");
    const navDrawer = qs("navDrawer");
    const btnConnect = qs("btnConnect");

    // 헤더가 아직 주입 전이면 false
    if (!btnConnect || !btnBurger || !navBackdrop || !navDrawer) return false;

    // 햄버거
    btnBurger.onclick = () => openNav(true);
    navBackdrop.onclick = () => openNav(false);
    navDrawer.onclick = (e) => {
      // 링크 클릭하면 닫기
      const a = e.target?.closest?.("a");
      if (a) openNav(false);
    };

    // 지갑연결 버튼은 메뉴 밖(우측)
    btnConnect.onclick = async () => {
      try {
        btnConnect.textContent = "연결중...";
        btnConnect.disabled = true;

        await Wallet.connect();

        btnConnect.textContent = "연결됨";
      } catch (e) {
        btnConnect.textContent = "지갑연결";
        alert(e?.shortMessage || e?.message || "지갑 연결 실패");
      } finally {
        btnConnect.disabled = false;
      }
    };

    // 이미 연결돼 있으면 토큰바 반영
    setTimeout(() => {
      Wallet.refreshTokenBar?.();
    }, 50);

    return true;
  }

  // partials 주입 타이밍 대응: 반복 체크
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // 지갑 연결/해제 이벤트 시 버튼 텍스트 갱신
  window.addEventListener("wallet:connected", () => {
    const btn = qs("btnConnect");
    if (btn) btn.textContent = "연결됨";
  });
  window.addEventListener("wallet:disconnected", () => {
    const btn = qs("btnConnect");
    if (btn) btn.textContent = "지갑연결";
  });
})();
