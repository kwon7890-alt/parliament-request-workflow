(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.AppCommon = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const STORAGE_KEY = "parliament-cases-v03";

  function parseCsv(text) {
    const source = String(text ?? "").replace(/^\uFEFF/, "");
    if (typeof globalThis !== "undefined" && globalThis.Papa) {
      const parsed = globalThis.Papa.parse(source, {
        header: true,
        skipEmptyLines: "greedy",
        transformHeader: (header) => header.trim(),
      });
      if (parsed.errors.length) throw new Error(`CSV 해석 오류: ${parsed.errors[0].message}`);
      return parsed.data;
    }
    const grid = [];
    let row = [], field = "", quoted = false;
    for (let index = 0; index < source.length; index += 1) {
      const character = source[index];
      if (quoted) {
        if (character === '"' && source[index + 1] === '"') { field += '"'; index += 1; }
        else if (character === '"') quoted = false;
        else field += character;
      } else if (character === '"') quoted = true;
      else if (character === ",") { row.push(field); field = ""; }
      else if (character === "\n") { row.push(field); grid.push(row); row = []; field = ""; }
      else if (character !== "\r") field += character;
    }
    if (quoted) throw new Error("CSV 따옴표가 닫히지 않았습니다.");
    if (field || row.length) { row.push(field); grid.push(row); }
    const rows = grid.filter((values) => values.some((value) => value.trim()));
    if (!rows.length) return [];
    const headers = rows[0].map((value) => value.trim());
    return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
  }

  function hash(value) {
    let result = 2166136261;
    for (const character of String(value)) {
      result ^= character.codePointAt(0);
      result = Math.imul(result, 16777619);
    }
    return (result >>> 0).toString(36);
  }

  function createMemoryStorage() {
    const values = new Map();
    return {
      getItem: (key) => values.has(key) ? values.get(key) : null,
      setItem: (key, value) => values.set(key, String(value)),
      removeItem: (key) => values.delete(key),
    };
  }

  function resolveStorage(storage) {
    if (storage) return storage;
    if (typeof localStorage !== "undefined") return localStorage;
    throw new Error("저장소가 없습니다.");
  }

  function loadCases(storage) {
    const raw = resolveStorage(storage).getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error("저장된 cases 형식이 배열이 아닙니다.");
    return parsed;
  }

  function saveCases(cases, storage) {
    resolveStorage(storage).setItem(STORAGE_KEY, JSON.stringify(cases));
    return cases;
  }

  function normalizeInput(item) {
    const source = item.파일명 ?? item.source ?? "";
    const questionNumber = String(item.문항번호 ?? item.questionNumber ?? "");
    if (!source || !questionNumber || !(item.요구내용 ?? item.requirement)) {
      throw new Error("파일명·문항번호·요구내용은 필수입니다.");
    }
    return {
      id: `case-${hash(`${source}|${questionNumber}`)}`,
      source,
      committee: item.위원회 ?? item.committee ?? "",
      member: item.의원 ?? item.member ?? "",
      dueDate: item.제출기한 ?? item.dueDate ?? "",
      questionNumber,
      requirement: item.요구내용 ?? item.requirement ?? "",
      subitems: item.세부항목 ?? item.subitems ?? "",
      note: item.비고 ?? item.note ?? "",
    };
  }

  function registerCases(items, storage, now = () => new Date().toISOString()) {
    const cases = loadCases(storage);
    const byId = new Map(cases.map((item) => [item.id, item]));
    let added = 0;
    for (const raw of items) {
      const item = normalizeInput(raw);
      if (byId.has(item.id)) continue;
      const created = {
        ...item,
        status: "접수",
        candidates: [],
        leadDepartment: "",
        supportDepartments: [],
        confirmationMethod: "",
        history: [{ action: "접수", actor: "국회 총괄 담당", at: now() }],
      };
      cases.push(created);
      byId.set(created.id, created);
      added += 1;
    }
    saveCases(cases, storage);
    return { added, total: cases.length, cases };
  }

  function setCandidates(id, candidates, storage) {
    const cases = loadCases(storage);
    const item = cases.find((entry) => entry.id === id);
    if (!item) throw new Error("문항을 찾을 수 없습니다.");
    item.candidates = candidates.slice(0, 3);
    saveCases(cases, storage);
    return item;
  }

  function confirmAssignment(id, assignment, organization, storage, now = () => new Date().toISOString()) {
    const allowed = new Set(organization.map((item) => typeof item === "string" ? item : item.과));
    const lead = assignment.leadDepartment;
    const supports = [...new Set(assignment.supportDepartments ?? [])].filter((department) => department !== lead);
    if (!allowed.has(lead)) throw new Error("주관 과가 조직도 26개 과에 없습니다.");
    if (supports.some((department) => !allowed.has(department))) throw new Error("협조 과가 조직도 26개 과에 없습니다.");
    if (!["규칙", "수정"].includes(assignment.confirmationMethod)) throw new Error("확정방법은 규칙 또는 수정이어야 합니다.");
    const cases = loadCases(storage);
    const item = cases.find((entry) => entry.id === id);
    if (!item) throw new Error("문항을 찾을 수 없습니다.");
    const previousLead = item.leadDepartment;
    item.leadDepartment = lead;
    item.supportDepartments = supports;
    item.confirmationMethod = assignment.confirmationMethod;
    item.status = "배분확정";
    item.history.push({
      action: "배분확정",
      actor: "국회 총괄 담당",
      at: now(),
      method: assignment.confirmationMethod,
      previousLead,
      leadDepartment: lead,
      supportDepartments: supports,
    });
    saveCases(cases, storage);
    return item;
  }

  function clearCases(storage) {
    resolveStorage(storage).removeItem(STORAGE_KEY);
  }

  return { STORAGE_KEY, parseCsv, createMemoryStorage, loadCases, saveCases, registerCases, setCandidates, confirmAssignment, clearCases };
});
