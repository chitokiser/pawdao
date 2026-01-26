// /assets/js/partials.js
(async () => {
  function $(id){ return document.getElementById(id); }

  // 현재 페이지(index.html, mypage.html 등) 위치 기준으로 URL 만들기
  function rel(path){
    return new URL(path, document.baseURI).toString();
  }

  async function loadInto(id, path) {
    const el = $(id);
    if (!el) return;

    const url = rel(path);

    try {
      const res = await fetch(url, { cache: "no-store" });

      // 실패하면 화면에 원인 표시 (지금 디버깅에 핵심)
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("[partials] fetch failed:", url, res.status, text.slice(0, 200));
        el.innerHTML =
          `<div style="padding:12px;border:1px solid rgba(255,255,255,.12);border-radius:12px;color:#9aa7c7;">
            partial 로드 실패: ${path} (HTTP ${res.status})<br>
            서버 루트에 파일이 있는지 확인하세요.
          </div>`;
        return;
      }

      el.innerHTML = await res.text();
    } catch (e) {
      console.error("[partials] fetch error:", url, e);
      el.innerHTML =
        `<div style="padding:12px;border:1px solid rgba(255,255,255,.12);border-radius:12px;color:#9aa7c7;">
          partial 로드 에러: ${path}<br>
          콘솔(F12)에서 에러 로그를 확인하세요.
        </div>`;
    }
  }

  // 절대경로(/partials/..) 금지. 항상 상대경로 사용.
  await loadInto("site-header", "partials/head.html");
  await loadInto("site-footer", "partials/footer.html");
})();
