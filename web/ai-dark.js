(function () {
  "use strict";

  const REDUCE = matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.documentElement.dataset.aiUi = "oka-workflow-light-v3";

  function formatTime(date = new Date()) {
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    }).format(date);
  }

  function installSafetyBar() {
    const header = document.querySelector(".topbar");
    if (!header || document.querySelector(".safety-bar")) return;
    const bar = document.createElement("div");
    bar.className = "safety-bar";
    bar.innerHTML = `
      <div class="safety-copy">
        <span class="live-dot" aria-hidden="true"></span>
        <b>공개 기능시험</b>
        <span>가상 문항만 사용 · 실자료·개인정보 입력 금지</span>
      </div>
      <div class="safety-meta">
        <span class="ai-policy">규칙·검색 우선 · AI는 선택 보조</span>
        <time class="live-time" aria-label="현재 시각"></time>
      </div>`;
    header.insertAdjacentElement("afterend", bar);
    const clock = bar.querySelector(".live-time");
    const tick = () => { clock.textContent = formatTime(); };
    tick();
    setInterval(tick, 1000);
  }

  function showError(message, options = {}) {
    let box = document.querySelector(".app-error");
    if (!box) {
      box = document.createElement("section");
      box.className = "app-error";
      box.setAttribute("role", "alert");
      const target = document.querySelector("main") || document.body;
      target.insertAdjacentElement("afterbegin", box);
    }
    box.innerHTML = `<div><b>화면을 불러오지 못했습니다.</b><p>${String(message || "잠시 후 다시 시도해 주세요.")}</p></div><button type="button">다시 불러오기</button>`;
    box.querySelector("button").addEventListener("click", () => location.reload());
    if (options.detail) box.title = String(options.detail);
    return box;
  }

  function installPanelSpotlight() {
    if (REDUCE) return;
    document.addEventListener("pointermove", (event) => {
      const panel = event.target.closest?.(".panel, .hero, .committee-hero");
      if (!panel) return;
      const rect = panel.getBoundingClientRect();
      panel.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      panel.style.setProperty("--my", `${event.clientY - rect.top}px`);
    }, { passive: true });
  }

  window.AppShell = { showError, formatTime };
  window.addEventListener("error", (event) => {
    if (event.error) showError("화면 처리 중 오류가 발생했습니다.", { detail: event.error.message });
  });
  window.addEventListener("unhandledrejection", (event) => {
    showError("자료 연결에 실패했습니다. 저장 서버 상태를 확인해 주세요.", { detail: event.reason?.message });
  });

  installSafetyBar();
  installPanelSpotlight();
})();
