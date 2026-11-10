(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; else root.ReplyValidator = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const text = (value) => String(value ?? "");
  const number = (value) => { const parsed = Number(String(value ?? "").replace(/,/g, "")); return Number.isFinite(parsed) ? parsed : 0; };
  function extractReplyWorkbook(workbook, XLSX) {
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
    const request = text(matrix[0]?.[0]).trim(), headers = (matrix[1] ?? []).map((value) => text(value).trim());
    const rows = matrix.slice(2).filter((row) => row.some((value) => text(value).trim())).map((row, index) => Object.fromEntries(headers.map((header, column) => [header, row[column] ?? ""]).concat([["__row", index + 3]])));
    return { request, headers, rows, issues: validateReply(request, rows) };
  }
  function validateReply(request, rows) {
    const issues = [], details = rows.filter((row) => text(row.연도).trim() !== "합계"), total = rows.find((row) => text(row.연도).trim() === "합계");
    const recent = request.match(/최근\s*(\d+)년/), currentYear = new Date().getFullYear();
    if (recent) {
      const count = Number(recent[1]), years = new Set(details.map((row) => Number(row.연도)).filter(Number.isFinite));
      for (let year = currentYear - count + 1; year <= currentYear; year += 1) if (!years.has(year)) issues.push({ type: "연도 누락", row: "-", message: `${year}년 행이 없습니다.` });
    }
    for (const row of details) if (number(row["집행액(천원)"]) > number(row["예산(천원)"]) && !text(row.비고).trim()) issues.push({ type: "집행액 확인", row: row.__row, message: "집행액이 예산보다 크지만 비고가 비어 있습니다." });
    if (total) {
      for (const key of ["개최횟수", "위원수", "예산(천원)", "집행액(천원)"]) {
        if (text(total[key]).trim() === "") continue;
        const sum = details.reduce((acc, row) => acc + number(row[key]), 0);
        if (number(total[key]) !== sum) issues.push({ type: "합계 불일치", row: total.__row, message: `${key} 합계 ${number(total[key]).toLocaleString()} ≠ 세부 합 ${sum.toLocaleString()}` });
      }
    }
    return issues;
  }
  function validateRegister(rows, organization) {
    const issues = [], departments = new Set(organization.map((item) => text(item.과).trim())), ids = new Map(), requirements = new Map();
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    rows.forEach((row, index) => {
      const line = index + 2, id = text(row.접수번호).trim(), requirement = text(row.요구내용).trim(), start = text(row.요구기간_시작).trim(), end = text(row.요구기간_끝).trim(), received = text(row.접수일).trim(), due = text(row.제출기한).trim(), department = text(row.배분과).trim();
      if (!start || !end) issues.push({ type: "연도 누락", row: line, message: "요구기간 시작 또는 끝 연도가 비어 있습니다." });
      else if (Number(start) > Number(end)) issues.push({ type: "기간 역전", row: line, message: `${start} > ${end}` });
      if (!departments.has(department)) issues.push({ type: "조직도 밖 부서", row: line, message: department || "빈 부서" });
      if (!datePattern.test(received) || !datePattern.test(due)) issues.push({ type: "날짜 형식", row: line, message: "접수일 또는 제출기한 형식이 YYYY-MM-DD가 아닙니다." });
      else if (due < received) issues.push({ type: "제출기한 이상", row: line, message: `${due} < ${received}` });
      if (ids.has(id)) issues.push({ type: "중복 접수번호", row: line, message: `${id} (앞 행 ${ids.get(id)})` }); else ids.set(id, line);
      if (requirements.has(requirement)) issues.push({ type: "중복 요구내용", row: line, message: `앞 행 ${requirements.get(requirement)}과 동일` }); else requirements.set(requirement, line);
      for (const key of ["접수번호", "위원회", "요구의원", "요구내용", "배분과"]) if (text(row[key]) !== text(row[key]).trim()) issues.push({ type: "표기 불일치", row: line, message: `${key} 앞뒤 공백` });
    });
    return issues;
  }
  return { extractReplyWorkbook, validateReply, validateRegister };
});

