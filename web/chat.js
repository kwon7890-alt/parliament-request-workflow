(function () {
  "use strict";
  const form = document.querySelector("#chatForm"), question = document.querySelector("#question"), messages = document.querySelector("#messages"), sendButton = document.querySelector("#sendButton"), apiMode = document.querySelector("#apiMode"), charCount = document.querySelector("#charCount"), initialMessage = messages.innerHTML;
  const hasServerApi = location.hostname.endsWith(".vercel.app") || location.port === "3000";
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  const scrollToLatest = () => messages.scrollTo({ top: messages.scrollHeight, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  function addMessage(role, text, error = false) { const article = document.createElement("article"); article.className = `message ${role}${error ? " error" : ""}`; article.innerHTML = `<div class="message-icon">${role === "user" ? "나" : "AI"}</div><div><b>${role === "user" ? "질문" : "업무 안내 AI"}</b><p>${escapeHtml(text)}</p></div>`; messages.append(article); scrollToLatest(); return article; }
  function addTyping() { const article = document.createElement("article"); article.className = "message assistant"; article.id = "typingMessage"; article.innerHTML = '<div class="message-icon">AI</div><div><b>답변 확인 중</b><span class="typing" aria-label="답변을 준비하고 있습니다"><i></i><i></i><i></i></span></div>'; messages.append(article); scrollToLatest(); return article; }
  function localAnswer(message) {
    const text = message.toLowerCase();
    if (text.includes("배분")) return "배분기준표 CSV와 조직도 26개 과를 바탕으로 후보를 확인한 뒤, 국회 총괄 담당자가 근거와 업무 경계를 검토하여 최종 확정합니다.";
    if (text.includes("절차") || text.includes("처리")) return "요구서 접수 → 문항 분해 → 소관 과 후보 추천 → 총괄 담당자의 배분 확정 → 현업 회신 → 취합 순서입니다. 답변 작성·결재·국회 제출은 자동 처리하지 않습니다.";
    if (text.includes("api") || text.includes("키")) return "무료 LLM 키는 브라우저 코드가 아니라 Vercel 프로젝트의 GROQ_API_KEY 환경변수에만 둡니다. 실제 개인정보나 기관 원문은 무료 외부 LLM에 입력하지 마세요.";
    return "현재 로컬 미리보기는 안전한 안내 모드입니다. Vercel에 GROQ_API_KEY를 설정하면 무료 LLM 답변으로 전환됩니다. 공통 툴의 절차·배분·회신·취합 사용법을 질문해 주세요.";
  }
  async function ask(message) {
    addMessage("user", message); question.value = ""; charCount.textContent = "0"; sendButton.disabled = true; const typing = addTyping();
    if (!hasServerApi) { typing.remove(); addMessage("assistant", localAnswer(message)); apiMode.classList.add("ready"); apiMode.lastChild.textContent = "로컬 안내 모드"; sendButton.disabled = false; question.focus(); return; }
    try { const response = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message }) }); const contentType = response.headers.get("content-type") || ""; if (!contentType.includes("application/json")) throw new Error("LOCAL_STATIC_SERVER"); const body = await response.json(); if (!response.ok) throw new Error(body.error || "답변을 가져오지 못했습니다."); typing.remove(); addMessage("assistant", body.answer); apiMode.classList.add("ready"); apiMode.lastChild.textContent = body.mode; document.querySelector("#aiScene")?.dispatchEvent(new CustomEvent("answer-pulse")); }
    catch (error) { typing.remove(); addMessage("assistant", localAnswer(message)); apiMode.classList.add("ready"); apiMode.lastChild.textContent = "로컬 안내 모드"; }
    finally { sendButton.disabled = false; question.focus(); }
  }
  form.addEventListener("submit", (event) => { event.preventDefault(); const message = question.value.trim(); if (message) ask(message); });
  question.addEventListener("input", () => { charCount.textContent = String(question.value.length); });
  question.addEventListener("keydown", (event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); } });
  document.querySelector(".suggestions").addEventListener("click", (event) => { const button = event.target.closest("button"); if (button && !sendButton.disabled) ask(button.textContent.trim()); });
  document.querySelector("#clearChat").addEventListener("click", () => { messages.innerHTML = initialMessage; question.value = ""; charCount.textContent = "0"; question.focus(); });
  apiMode.lastChild.textContent = "질문 대기 중";
})();

