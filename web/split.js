(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.RequestSplitter = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const titlePattern = /^(.+?위원회)\s+(.+?)\s+의원실\s+자료요구서$/;
  const deadlinePattern = /제출기한:\s*(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\./;
  const questionPattern = /^\s*(\d+)\.\s*(.+?)\s*$/;
  const subitemPattern = /^\s*([가-힣])\.\s*(.+?)\s*$/;
  const notePattern = /^\s*※\s*(.+?)\s*$/;
  const expectedPattern = /_(\d+)문항\.pdf$/i;
  const phonePattern = /(^|\D)\d{2,3}-\d{3,4}-\d{4}(?!\d)/;
  const emailPattern = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

  const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();
  const append = (parts, value) => { const text = clean(value); if (text) parts.push(text); };

  function parseLines(fileName, sourceLines) {
    const lines = sourceLines.map((line) => String(line).replace(/\r$/, ""));
    const nonempty = lines.map((line) => line.trim()).filter(Boolean);
    if (!nonempty.length) throw new Error(`${fileName}: 텍스트를 추출할 수 없습니다.`);
    const title = nonempty[0].match(titlePattern);
    if (!title) throw new Error(`${fileName}: 첫 줄에서 위원회·의원을 찾지 못했습니다.`);
    const deadlineMatch = nonempty.map((line) => line.match(deadlinePattern)).find(Boolean);
    if (!deadlineMatch) throw new Error(`${fileName}: 제출기한을 찾지 못했습니다.`);
    const deadline = `${deadlineMatch[1]}-${deadlineMatch[2].padStart(2, "0")}-${deadlineMatch[3].padStart(2, "0")}`;
    const questions = [];
    let current = null, lastKind = "";

    for (const raw of lines) {
      const line = raw.trim();
      if (!line || line === nonempty[0]) continue;
      if (line.startsWith("수신:") || line.startsWith("담당 보좌관:") || line === "끝.") continue;
      const question = line.match(questionPattern);
      if (question) {
        current = { number: Number(question[1]), requirement: [question[2]], subitems: [], notes: [] };
        questions.push(current);
        lastKind = "requirement";
        continue;
      }
      if (!current) continue;
      const subitem = line.match(subitemPattern);
      if (subitem) {
        current.subitems.push([`${subitem[1]}. ${subitem[2]}`]);
        lastKind = "subitem";
        continue;
      }
      const note = line.match(notePattern);
      if (note) {
        current.notes.push([note[1]]);
        lastKind = "note";
        continue;
      }
      if (lastKind === "subitem" && current.subitems.length) append(current.subitems.at(-1), line);
      else if (lastKind === "note" && current.notes.length) append(current.notes.at(-1), line);
      else { append(current.requirement, line); lastKind = "requirement"; }
    }

    const rows = questions.map((question) => {
      const requirement = question.requirement.join(" ");
      const subitems = question.subitems.map((parts) => parts.join(" ")).join(" / ");
      const note = question.notes.map((parts) => parts.join(" ")).join("\n");
      const combined = [requirement, subitems, note].join("\n");
      if (combined.includes("수신:") || combined.includes("담당 보좌관:") || phonePattern.test(combined) || emailPattern.test(combined)) {
        throw new Error(`${fileName}: 개인정보로 보이는 값이 문항에 포함됐습니다.`);
      }
      return {
        파일명: fileName, 위원회: title[1], 의원: title[2], 제출기한: deadline,
        문항번호: String(question.number), 요구내용: requirement, 세부항목: subitems, 비고: note,
      };
    });

    const expectedMatch = fileName.match(expectedPattern);
    if (!expectedMatch) throw new Error(`${fileName}: 파일명에서 문항 수를 찾지 못했습니다.`);
    const expected = Number(expectedMatch[1]);
    const numbers = rows.map((row) => Number(row.문항번호));
    const continuous = numbers.every((number, index) => number === index + 1);
    const lastNumber = numbers.at(-1) ?? 0;
    const matched = rows.length === expected && lastNumber === expected && continuous;
    return {
      rows,
      summary: { 파일명: fileName, 파일명의문항수: expected, 뽑은문항수: rows.length, 마지막번호: lastNumber, 번호연속: continuous, 일치: matched },
    };
  }

  function parseText(fileName, text) {
    return parseLines(fileName, String(text ?? "").split(/\r?\n/));
  }

  return { parseLines, parseText };
});
