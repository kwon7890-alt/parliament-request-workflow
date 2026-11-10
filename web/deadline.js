(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.DeadlineReminder = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const ACTIVE = new Set(["배분확정", "회신중", "보완요청"]);
  const text = (value) => String(value ?? "").trim();
  const unique = (values) => [...new Set(values.map(text).filter(Boolean))];
  const parseDate = (value) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text(value));
    if (!match) return null;
    const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
  };
  const assigned = (item) => unique([item.leadDepartment, ...(item.supportDepartments ?? [])]);
  const outstanding = (item) => assigned(item).filter((department) => !item.replies?.[department] || item.supplements?.[department]);
  const label = (days) => days < 0 ? "기한 경과" : days === 0 ? "D-day" : `D-${days}`;

  function collect(cases, baseline, threshold = 2) {
    const base = parseDate(baseline), limit = Number(threshold);
    if (!base) throw new Error("기준일은 YYYY-MM-DD 형식이어야 합니다.");
    if (!Number.isInteger(limit) || limit < 0 || limit > 365) throw new Error("임박 일수는 0~365의 정수여야 합니다.");
    const targets = [], review = [];
    for (const item of Array.isArray(cases) ? cases : []) {
      if (!ACTIVE.has(item.status)) continue;
      const departments = outstanding(item);
      if (!departments.length) continue;
      const due = parseDate(item.dueDate);
      if (!due) {
        departments.forEach((department) => review.push({ 과: department, 제출기한: text(item.dueDate) || "빈값", 문항: `${text(item.member)}-${text(item.questionNumber)}`, 요구내용: text(item.requirement), 상태: item.status, 사유: "제출기한 형식 확인필요" }));
        continue;
      }
      const days = Math.round((due.getTime() - base.getTime()) / 86400000);
      if (days > limit) continue;
      departments.forEach((department) => targets.push({ 과: department, 구분: label(days), 남은날: days, 제출기한: text(item.dueDate), 문항: `${text(item.member)}-${text(item.questionNumber)}`, 요구내용: text(item.requirement), 상태: item.status }));
    }
    targets.sort((a, b) => a.과.localeCompare(b.과, "ko") || a.남은날 - b.남은날 || a.문항.localeCompare(b.문항, "ko"));
    review.sort((a, b) => a.과.localeCompare(b.과, "ko") || a.문항.localeCompare(b.문항, "ko"));
    return { targets, review, departmentCount: new Set(targets.map((row) => row.과)).size };
  }

  function noticeText(targets, sender) {
    const byDepartment = new Map();
    targets.forEach((row) => { if (!byDepartment.has(row.과)) byDepartment.set(row.과, []); byDepartment.get(row.과).push(row); });
    return [...byDepartment].map(([department, rows]) => [
      `수신: ${department}`,
      "제목: 국회 요구자료 회신기한 확인 요청",
      `건수: ${rows.length}건`,
      ...rows.map((row, index) => `${index + 1}. [${row.구분}] ${row.문항} · ${row.제출기한} · ${row.요구내용}`),
      `발신: ${text(sender) || "국회 총괄 담당"}`,
    ].join("\n")).join("\n\n---\n\n");
  }

  return { parseDate, assigned, outstanding, collect, noticeText };
});
