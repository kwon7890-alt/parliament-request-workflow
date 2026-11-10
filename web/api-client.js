(function (root) {
  "use strict";
  const serverMode = typeof location !== "undefined" && location.hostname.endsWith(".vercel.app");

  async function getCases() {
    if (!serverMode) return AppCommon.loadCases();
    const response = await fetch("/api/app");
    const body = await response.json();
    if (!response.ok) throw new Error(body.error || "처리 기록을 읽지 못했습니다.");
    return body.cases;
  }

  async function post(action, payload, organization) {
    if (serverMode) {
      const response = await fetch("/api/app", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, ...payload }) });
      const body = await response.json();
      if (!response.ok) { const error = new Error(body.error || "작업을 처리하지 못했습니다."); error.status = response.status; throw error; }
      return body;
    }
    const outcome = FlowEngine.apply(AppCommon.loadCases(), { action, ...payload }, organization);
    AppCommon.saveCases(outcome.db);
    return { cases: outcome.db, result: outcome.result, mode: "브라우저 저장" };
  }

  function clear() {
    if (serverMode) throw new Error("공유 서버 기록은 화면에서 일괄 초기화할 수 없습니다.");
    AppCommon.clearCases();
  }

  root.ApiClient = { getCases, post, clear, mode: serverMode ? "Vercel 공유 저장" : "브라우저 저장" };
})(typeof globalThis !== "undefined" ? globalThis : this);
