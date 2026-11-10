(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.FlowEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const OFFICIAL_ANSWER_TEMPLATE = "official-answer";
  const METHODS = new Set(["규칙", "AI", "수정"]);

  class FlowError extends Error {
    constructor(status, message) { super(message); this.name = "FlowError"; this.status = status; }
  }

  const fail = (status, message) => { throw new FlowError(status, message); };
  const clean = (value, max = 4000) => String(value ?? "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
  const clone = (value) => JSON.parse(JSON.stringify(value ?? []));
  const departments = (organization) => new Set((organization ?? []).map((item) => clean(typeof item === "string" ? item : item.과)).filter(Boolean));
  const findCase = (db, id) => {
    const item = db.find((entry) => entry.id === id);
    if (!item) fail(404, "문항을 찾을 수 없습니다.");
    return item;
  };
  const unique = (values) => [...new Set((values ?? []).map((value) => clean(value)).filter(Boolean))];
  const assignedDepartments = (item) => unique([item.leadDepartment, ...(item.supportDepartments ?? [])]);

  function sanitizedCase(raw, at) {
    const source = clean(raw.source ?? raw.파일명, 500);
    const questionNumber = clean(raw.questionNumber ?? raw.문항번호, 30);
    const requirement = clean(raw.requirement ?? raw.요구내용, 12000);
    if (!source || !questionNumber || !requirement) fail(400, "파일명·문항번호·요구내용은 필수입니다.");
    const id = clean(raw.id, 120) || `case-${source}-${questionNumber}`;
    return {
      id,
      source,
      committee: clean(raw.committee ?? raw.위원회, 120),
      member: clean(raw.member ?? raw.의원, 120),
      dueDate: clean(raw.dueDate ?? raw.제출기한, 30),
      questionNumber,
      requirement,
      subitems: clean(raw.subitems ?? raw.세부항목, 8000),
      note: clean(raw.note ?? raw.비고, 4000),
      status: "접수",
      candidates: Array.isArray(raw.candidates) ? raw.candidates.slice(0, 3).map((candidate) => ({
        과: clean(candidate.과, 120),
        점수: Number(candidate.점수) || 0,
        근거키워드: unique(candidate.근거키워드).slice(0, 20),
      })) : [],
      leadDepartment: "",
      supportDepartments: [],
      confirmationMethod: "",
      replies: {},
      outputTemplateId: OFFICIAL_ANSWER_TEMPLATE,
      history: [{ action: "접수", actorRole: "국회 총괄 담당", at }],
    };
  }

  function apply(database, request, organization, now = () => new Date().toISOString()) {
    const db = clone(Array.isArray(database) ? database : []);
    const action = clean(request?.action, 30);
    const at = now();
    const allowed = departments(organization);

    if (action === "접수") {
      const incoming = Array.isArray(request.cases) ? request.cases : [];
      if (!incoming.length) fail(400, "접수할 문항이 없습니다.");
      const known = new Set(db.map((item) => item.id));
      let added = 0;
      for (const raw of incoming) {
        const item = sanitizedCase(raw, at);
        if (known.has(item.id)) continue;
        db.push(item); known.add(item.id); added += 1;
      }
      return { db, result: { action, added, total: db.length } };
    }

    const item = findCase(db, clean(request.id, 160));

    if (action === "배분") {
      if (!["접수", "재배정요청"].includes(item.status)) fail(409, `현재 단계(${item.status})에서는 배분할 수 없습니다.`);
      const lead = clean(request.leadDepartment, 120);
      const supports = unique(request.supportDepartments).filter((department) => department !== lead);
      const method = clean(request.confirmationMethod, 20);
      if (!allowed.has(lead) || supports.some((department) => !allowed.has(department))) fail(400, "조직도 26개 과 밖의 부서는 배분할 수 없습니다.");
      if (!METHODS.has(method)) fail(400, "확정방법은 규칙·AI·수정 중 하나여야 합니다.");
      item.leadDepartment = lead;
      item.supportDepartments = supports;
      item.confirmationMethod = method;
      item.replies = {};
      item.status = "배분확정";
      item.reassignment = null;
      item.outputTemplateId = OFFICIAL_ANSWER_TEMPLATE;
      item.history.push({ action: "배분", actorRole: "국회 총괄 담당", at, leadDepartment: lead, supportDepartments: supports, method });
      return { db, result: { action, item } };
    }

    if (action === "회신") {
      if (!["배분확정", "회신중"].includes(item.status)) fail(409, `현재 단계(${item.status})에서는 회신할 수 없습니다.`);
      const actorDepartment = clean(request.actorDepartment, 120);
      if (!assignedDepartments(item).includes(actorDepartment)) fail(403, "배분된 담당 과만 회신할 수 있습니다.");
      if (request.templateId !== OFFICIAL_ANSWER_TEMPLATE) fail(400, "OOOO청 공식 답변양식만 사용할 수 있습니다.");
      const memo = clean(request.memo, 12000);
      const fileName = clean(request.fileName, 300);
      if (!memo && !fileName) fail(400, "회신 메모 또는 회신 파일이 필요합니다.");
      item.replies ||= {};
      item.replies[actorDepartment] = {
        department: actorDepartment,
        memo,
        sourceFileName: fileName,
        sourceFileSize: Math.max(0, Number(request.fileSize) || 0),
        templateId: OFFICIAL_ANSWER_TEMPLATE,
        submittedAt: at,
      };
      const assigned = assignedDepartments(item);
      item.status = assigned.every((department) => item.replies[department]) ? "회신완료" : "회신중";
      item.history.push({ action: "회신", actorDepartment, at, templateId: OFFICIAL_ANSWER_TEMPLATE, status: item.status });
      return { db, result: { action, item } };
    }

    if (action === "재배정요청") {
      if (!["배분확정", "회신중"].includes(item.status)) fail(409, `현재 단계(${item.status})에서는 재배정을 요청할 수 없습니다.`);
      const actorDepartment = clean(request.actorDepartment, 120);
      if (!assignedDepartments(item).includes(actorDepartment)) fail(403, "배분된 담당 과만 재배정을 요청할 수 있습니다.");
      const reason = clean(request.reason, 2000);
      const desiredDepartment = clean(request.desiredDepartment, 120);
      if (!reason) fail(400, "재배정 요청 사유는 필수입니다.");
      if (!allowed.has(desiredDepartment)) fail(400, "희망 과가 조직도 26개 과에 없습니다.");
      item.status = "재배정요청";
      item.reassignment = { actorDepartment, reason, desiredDepartment, requestedAt: at };
      item.history.push({ action: "재배정요청", actorDepartment, at, reason, desiredDepartment });
      return { db, result: { action, item } };
    }

    fail(400, "지원하지 않는 작업입니다.");
  }

  return { apply, FlowError, OFFICIAL_ANSWER_TEMPLATE };
});
