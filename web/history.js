(function (root) {
  "use strict";
  let rows = [];
  async function initialize(url = "./data/접수대장.csv") {
    const response = await fetch(url);
    if (!response.ok) throw new Error("과거 접수대장을 읽지 못했습니다.");
    rows = AppCommon.parseCsv(await response.text());
    if (rows.length !== 520) throw new Error(`과거 접수대장은 520건이어야 합니다. 현재 ${rows.length}건입니다.`);
    return rows.length;
  }
  function find(item) {
    const firstKeyword = (item.candidates?.[0]?.근거키워드 ?? []).find((word) => String(word).length >= 2);
    const keywords = firstKeyword ? [firstKeyword] : [];
    if (!keywords.length) return { count: 0, mainDepartment: "", recent: [], keywords: [] };
    const matched = rows.filter((row) => keywords.some((keyword) => String(row.요구내용 ?? "").includes(keyword)));
    const counts = new Map();
    for (const row of matched) counts.set(row.배분과, (counts.get(row.배분과) ?? 0) + 1);
    const mainDepartment = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ko"))[0]?.[0] ?? "";
    const recent = [...matched].sort((a, b) => String(b.접수일).localeCompare(String(a.접수일))).slice(0, 5);
    return { count: matched.length, mainDepartment, recent, keywords };
  }
  root.PastHistory = { initialize, find };
})(typeof globalThis !== "undefined" ? globalThis : this);
