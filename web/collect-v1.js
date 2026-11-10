(function () {
  "use strict";
  const $ = (selector) => document.querySelector(selector), esc = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]);
  let cases = [], organization = [], departmentChart, deadlineResult = { targets: [], review: [], departmentCount: 0 };
  const assigned = (item) => [...new Set([item.leadDepartment, ...(item.supportDepartments ?? [])].filter(Boolean))];
  const combined = () => cases.flatMap((item) => Object.values(item.replies ?? {}).flatMap((reply) => (reply.rows?.length ? reply.rows : [{ 회신메모: reply.memo || "" }]).map((row) => ({ 문항ID: item.id, 의원문항: `${item.member} ${item.questionNumber}번`, 회신과: reply.department, 상태: item.status, ...row }))));
  function renderCombined() {
    const rows = combined(), headers = [...new Set(rows.flatMap((row) => Object.keys(row).filter((key) => key !== "__row")))];
    $("#combinedHead").innerHTML = headers.length ? `<tr>${headers.map((key) => `<th>${esc(key)}</th>`).join("")}</tr>` : "";
    $("#combinedRows").innerHTML = rows.length ? rows.map((row) => `<tr>${headers.map((key) => `<td>${esc(row[key])}</td>`).join("")}</tr>`).join("") : '<tr><td class="empty">저장된 회신 행이 없습니다.</td></tr>';
    const counts = new Map(); rows.forEach((row) => counts.set(row.회신과, (counts.get(row.회신과) || 0) + 1));
    departmentChart?.destroy(); departmentChart = new Chart($("#departmentChart"), { type: "bar", data: { labels: [...counts.keys()], datasets: [{ label: "회신 행 수", data: [...counts.values()], backgroundColor: "#2356d8", borderRadius: 7 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } } });
  }
  function renderReviews() {
    const reviewable = cases.filter((item) => ["회신완료", "보완요청", "확정"].includes(item.status));
    $("#reviewCases").innerHTML = reviewable.length ? reviewable.map((item) => {
      const departments = assigned(item), issues = Object.values(item.replies ?? {}).flatMap((reply) => (reply.validationIssues ?? []).map((issue) => `${reply.department} · ${issue.type}: ${issue.message}`));
      const options = departments.map((department) => `<option value="${esc(department)}">${esc(department)}</option>`).join("");
      return `<article class="review-card" data-id="${esc(item.id)}"><div class="review-card-head"><div><h3>${esc(item.member)} ${esc(item.questionNumber)}번 · ${esc(item.status)}</h3><p>${esc(item.requirement)}</p></div><span class="status ${item.status === "확정" ? "done" : ""}">${esc(item.status)}</span></div><div class="issue-tags">${issues.length ? issues.map((issue) => `<span>${esc(issue)}</span>`).join("") : '<span style="background:#e7f7f0;color:#13755a">자동검사 확인필요 없음</span>'}</div>${item.status === "확정" ? `<div class="history">확정 코멘트: ${esc(item.finalization?.comment)}</div>` : `<div class="review-actions"><select class="select supplement-department">${options}</select><input class="input supplement-reason" placeholder="보완 요청 사유"><button class="btn warn supplement" type="button" ${item.status === "보완요청" ? "disabled" : ""}>보완 요청</button><input class="input final-comment" placeholder="확정 코멘트"><button class="btn finalize" type="button" ${item.status !== "회신완료" ? "disabled" : ""}>확인 완료</button></div>`}</article>`;
    }).join("") : '<div class="empty">회신완료 문항이 없습니다.</div>';
  }
  const todayKst = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  function renderDeadlines() {
    try {
      deadlineResult = DeadlineReminder.collect(cases, $("#deadlineBase").value, Number($("#deadlineDays").value));
      $("#deadlineSummary").textContent = `대상 ${deadlineResult.targets.length}건 · ${deadlineResult.departmentCount}개 과`;
      $("#deadlineBadge").textContent = deadlineResult.targets.length;
      $("#deadlineRows").innerHTML = deadlineResult.targets.length ? deadlineResult.targets.map((row) => `<tr><td>${esc(row.과)}</td><td><span class="due-chip ${row.구분 === "기한 경과" ? "overdue" : ""}">${esc(row.구분)}</span></td><td>${esc(row.제출기한)}</td><td>${esc(row.문항)}</td><td>${esc(row.요구내용)}</td><td>${esc(row.상태)}</td></tr>`).join("") : '<tr><td colspan="6" class="empty">조건에 맞는 미회신 과가 없습니다.</td></tr>';
      $("#deadlineReviewRows").innerHTML = deadlineResult.review.length ? deadlineResult.review.map((row) => `<tr><td>${esc(row.과)}</td><td>${esc(row.제출기한)}</td><td>${esc(row.문항)}</td><td>${esc(row.사유)}</td></tr>`).join("") : '<tr><td colspan="4" class="empty">날짜 확인필요가 없습니다.</td></tr>';
      $("#deadlineNotice").className = "notice";
      $("#deadlineNotice").textContent = "";
    } catch (error) {
      $("#deadlineNotice").className = "notice on error";
      $("#deadlineNotice").textContent = error.message;
    }
  }
  function setWorkspace(name) {
    const deadline = name === "deadline";
    document.querySelectorAll(".summary-workspace").forEach((element) => { element.hidden = deadline; });
    $("#deadlineWorkspace").hidden = !deadline;
    $("#summaryTab").classList.toggle("active", !deadline); $("#summaryTab").setAttribute("aria-selected", String(!deadline));
    $("#deadlineTab").classList.toggle("active", deadline); $("#deadlineTab").setAttribute("aria-selected", String(deadline));
  }
  async function load() { cases = await ApiClient.getCases(); renderReviews(); renderCombined(); renderDeadlines(); }
  $("#reviewCases").addEventListener("click", async (event) => {
    const card = event.target.closest(".review-card"); if (!card) return;
    try {
      if (event.target.closest(".supplement")) { await ApiClient.post("보완요청", { id: card.dataset.id, targetDepartment: card.querySelector(".supplement-department").value, reason: card.querySelector(".supplement-reason").value }, organization); await load(); render(); }
      if (event.target.closest(".finalize")) { await ApiClient.post("확정", { id: card.dataset.id, comment: card.querySelector(".final-comment").value }, organization); await load(); render(); }
    } catch (error) { alert(error.message); }
  });
  $("#registerAuditFile").addEventListener("change", async (event) => {
    const file = event.target.files[0]; if (!file) return;
    try {
      const rows = AppCommon.parseCsv(await file.text()), issues = ReplyValidator.validateRegister(rows, organization), affected = new Set(issues.map((issue) => issue.row)).size;
      $("#registerAuditResult").innerHTML = `<div class="audit-summary"><span>전체 ${rows.length}건</span><span>확인필요 행 ${affected}건</span><span>검출 항목 ${issues.length}건</span></div><ul class="audit-list">${issues.map((issue) => `<li><b>${esc(issue.row)}행</b><span>${esc(issue.type)}</span><span>${esc(issue.message)}</span></li>`).join("")}</ul>`;
    } catch (error) { $("#registerAuditResult").innerHTML = `<div class="notice on error">${esc(error.message)}</div>`; }
  });
  function submissionList() { return cases.map((item) => ({ 문항ID: item.id, 위원회: item.committee, 의원: item.member, 문항번호: item.questionNumber, 요구내용: item.requirement, 주관과: item.leadDepartment, 협조과: (item.supportDepartments ?? []).join(" | "), 상태: item.status, 확인코멘트: item.finalization?.comment ?? "" })); }
  $("#exportSubmissionXlsx").addEventListener("click", () => { const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(submissionList()), "제출목록"); XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(combined()), "문항별 취합표"); XLSX.writeFile(workbook, "0000청_외통위_검토용_취합본.xlsx"); });
  $("#exportSubmissionMd").addEventListener("click", () => { const lines = ["# 0000청 외통위 요구자료 검토용 취합본", "", "> 공식 제출 전 담당자 확인용이며 자동 제출되지 않습니다.", "", "| 의원·문항 | 주관 과 | 상태 | 확인 코멘트 |", "|---|---|---|---|", ...cases.map((item) => `| ${item.member} ${item.questionNumber}번 | ${item.leadDepartment || "-"} | ${item.status} | ${item.finalization?.comment ?? ""} |`)]; const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" })); const link = document.createElement("a"); link.href = url; link.download = "0000청_외통위_검토용_취합본.md"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); });
  $("#summaryTab").addEventListener("click", () => setWorkspace("summary"));
  $("#deadlineTab").addEventListener("click", () => setWorkspace("deadline"));
  ["#deadlineBase", "#deadlineDays", "#deadlineSender"].forEach((selector) => $(selector).addEventListener("input", renderDeadlines));
  $("#exportDeadlineXlsx").addEventListener("click", () => { const workbook = XLSX.utils.book_new(), targetRows = deadlineResult.targets.map(({ 남은날, ...row }) => row); XLSX.utils.book_append_sheet(workbook, targetRows.length ? XLSX.utils.json_to_sheet(targetRows) : XLSX.utils.aoa_to_sheet([["과", "구분", "제출기한", "문항", "요구내용", "상태"]]), "독촉목록"); XLSX.utils.book_append_sheet(workbook, deadlineResult.review.length ? XLSX.utils.json_to_sheet(deadlineResult.review) : XLSX.utils.aoa_to_sheet([["과", "제출기한", "문항", "요구내용", "상태", "사유"]]), "확인필요"); XLSX.writeFile(workbook, "독촉목록_국회요구자료.xlsx"); });
  $("#exportDeadlineText").addEventListener("click", () => { const content = DeadlineReminder.noticeText(deadlineResult.targets, $("#deadlineSender").value) || "독촉 대상이 없습니다."; const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" })), link = document.createElement("a"); link.href = url; link.download = "과별_회신기한_안내문.txt"; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); });
  (async () => { $("#deadlineBase").value = todayKst(); const response = await fetch("./data/A부_조직도_26개과.csv"); organization = AppCommon.parseCsv(await response.text()); await load(); })().catch((error) => { $("#reviewCases").innerHTML = `<div class="notice on error">${esc(error.message)}</div>`; });
})();
