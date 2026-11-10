(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.HistoryLog = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const text = (value) => String(value ?? "").trim();
  const unique = (values) => [...new Set(values.map(text).filter(Boolean))];

  function formatKst(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "확인필요";
    const parts = new Intl.DateTimeFormat("ko-KR", {
      timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
    }).formatToParts(date);
    const get = (type) => parts.find((part) => part.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}`;
  }

  function eventDepartments(event) {
    return unique([
      event.actorDepartment,
      event.targetDepartment,
      event.leadDepartment,
      ...(Array.isArray(event.supportDepartments) ? event.supportDepartments : []),
    ]);
  }

  function questionLabel(item) {
    const member = text(item.member) || "익명";
    const number = text(item.questionNumber) || "?";
    return `${member}-${number}`;
  }

  function flatten(cases) {
    return (Array.isArray(cases) ? cases : []).flatMap((item) => (item.history ?? []).map((event, index) => {
      const departments = eventDepartments(event);
      return {
        id: `${text(item.id)}-${index}`,
        at: text(event.at),
        일시: formatKst(event.at),
        작업: text(event.action) || "확인필요",
        문항: questionLabel(item),
        요구내용: text(item.requirement),
        과목록: departments,
        과: departments.join(" | ") || "-",
        지금상태: text(item.status) || "확인필요",
      };
    })).sort((a, b) => Date.parse(b.at || 0) - Date.parse(a.at || 0));
  }

  function filter(rows, criteria = {}) {
    const action = text(criteria.action), department = text(criteria.department), prefix = text(criteria.questionPrefix).toLocaleLowerCase("ko-KR");
    return (Array.isArray(rows) ? rows : []).filter((row) => {
      if (action && row.작업 !== action) return false;
      if (department && !row.과목록.includes(department)) return false;
      if (prefix && !row.문항.toLocaleLowerCase("ko-KR").startsWith(prefix)) return false;
      return true;
    });
  }

  function sheetRows(rows) {
    return rows.map((row) => ({ 일시: row.일시, 작업: row.작업, 문항: row.문항, 과: row.과, 지금상태: row.지금상태 }));
  }

  return { formatKst, flatten, filter, sheetRows };
});
