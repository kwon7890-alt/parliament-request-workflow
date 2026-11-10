"use strict";

const assert = require("node:assert/strict");
const FlowEngine = require("./web/flow.js");
const organization = require("./api/org.json");
const { createHandler } = require("./api/app.js");

function fakeStore(initial = []) {
  let cases = JSON.parse(JSON.stringify(initial));
  let writes = 0;
  return {
    async read() { return { cases: JSON.parse(JSON.stringify(cases)), etag: writes ? `etag-${writes}` : null }; },
    async write(next) { cases = JSON.parse(JSON.stringify(next)); writes += 1; },
    snapshot() { return { cases, writes }; },
  };
}

async function call(handler, method, body) {
  let statusCode, payload;
  const response = { status(code) { statusCode = code; return this; }, json(value) { payload = value; return value; } };
  await handler({ method, body }, response);
  return { statusCode, payload };
}

(async () => {
  const store = fakeStore();
  const handler = createHandler({ store, organization });
  const sample = { id: "case-test-1", source: "형식제각각_질의서.hwp", questionNumber: "1", requirement: "정보보안장비 운영 현황", member: "의원K", candidates: [{ 과: "디지털정책과", 점수: 10, 근거키워드: ["정보보안"] }], phone: "저장금지" };

  assert.equal((await call(handler, "POST", { action: "접수", cases: [sample] })).statusCode, 200);
  assert.equal(store.snapshot().cases[0].phone, undefined);

  const beforeRejected = JSON.stringify(store.snapshot().cases);
  assert.equal((await call(handler, "POST", { action: "회신", id: sample.id, actorDepartment: "디지털정책과", memo: "먼저 회신", templateId: "official-answer" })).statusCode, 409);
  assert.equal(JSON.stringify(store.snapshot().cases), beforeRejected);
  assert.equal((await call(handler, "POST", { action: "배분", id: sample.id, leadDepartment: "미래전략과", supportDepartments: [], confirmationMethod: "규칙" })).statusCode, 400);
  assert.equal((await call(handler, "POST", { action: "배분", id: sample.id, leadDepartment: "디지털정책과", supportDepartments: [], confirmationMethod: "규칙" })).statusCode, 200);
  assert.equal((await call(handler, "POST", { action: "회신", id: sample.id, actorDepartment: "운영지원과", memo: "다른 과 회신", templateId: "official-answer" })).statusCode, 403);
  assert.equal((await call(handler, "POST", { action: "회신", id: sample.id, actorDepartment: "디지털정책과", memo: "정상 회신", fileName: "회신_디지털정책과.xlsx", templateId: "다른양식" })).statusCode, 400);
  assert.equal((await call(handler, "POST", { action: "회신", id: sample.id, actorDepartment: "디지털정책과", memo: "정상 회신", fileName: "회신_디지털정책과.xlsx", templateId: FlowEngine.OFFICIAL_ANSWER_TEMPLATE })).statusCode, 200);

  const second = { id: "case-test-2", source: "또다른_질의서.hwp", questionNumber: "2", requirement: "재난 대응 훈련 현황", member: "의원R" };
  assert.equal((await call(handler, "POST", { action: "접수", cases: [second] })).statusCode, 200);
  assert.equal((await call(handler, "POST", { action: "배분", id: second.id, leadDepartment: "재난대응과", supportDepartments: [], confirmationMethod: "수정" })).statusCode, 200);
  assert.equal((await call(handler, "POST", { action: "재배정요청", id: second.id, actorDepartment: "재난대응과", reason: "", desiredDepartment: "안전정책과" })).statusCode, 400);
  assert.equal((await call(handler, "POST", { action: "재배정요청", id: second.id, actorDepartment: "재난대응과", reason: "안전정책 총괄 문항", desiredDepartment: "안전정책과" })).statusCode, 200);

  const result = await call(handler, "GET");
  assert.equal(result.statusCode, 200);
  assert.equal(result.payload.cases[0].status, "회신완료");
  assert.equal(result.payload.cases[0].outputTemplateId, "official-answer");
  assert.equal(result.payload.cases[1].status, "재배정요청");
  assert.equal(store.snapshot().writes, 6);
  const aiHandler = createHandler({ store, organization, recommend: async (requirement) => {
    if (requirement.includes("목록밖")) return { 후보: [{ 과: "미래전략과", 근거: "목록 밖" }, { 과: "운영지원과", 근거: "청사 운영" }], 해당없음: false };
    if (requirement.includes("해당없음")) return { 후보: [], 해당없음: true };
    return { 후보: [{ 과: "정보보호과", 근거: "사이버 보안 업무" }], 해당없음: false };
  } });
  const aiValid = await call(aiHandler, "POST", { action: "AI추천", requirement: "사이버 보안 현황" });
  assert.equal(aiValid.statusCode, 200); assert.equal(aiValid.payload.후보[0].과, "정보보호과");
  const aiFiltered = await call(aiHandler, "POST", { action: "AI추천", requirement: "목록밖 후보 포함" });
  assert.deepEqual(aiFiltered.payload.후보.map((item) => item.과), ["운영지원과"]);
  const aiNone = await call(aiHandler, "POST", { action: "AI추천", requirement: "해당없음 문항" });
  assert.equal(aiNone.payload.해당없음, true); assert.equal(store.snapshot().writes, 6);

  assert.equal((await call(handler, "POST", { action: "보완요청", id: sample.id, targetDepartment: "디지털정책과", reason: "합계 불일치 확인" })).statusCode, 200);
  assert.equal(store.snapshot().cases[0].status, "보완요청");
  assert.equal((await call(handler, "POST", { action: "회신", id: sample.id, actorDepartment: "디지털정책과", memo: "합계 확인 완료", rows: [{ 연도: "2026", 예산: "100" }], validationIssues: [], templateId: FlowEngine.OFFICIAL_ANSWER_TEMPLATE })).statusCode, 200);
  assert.equal(store.snapshot().cases[0].status, "회신완료");
  assert.equal((await call(handler, "POST", { action: "확정", id: sample.id, comment: "" })).statusCode, 400);
  assert.equal((await call(handler, "POST", { action: "확정", id: sample.id, comment: "수치와 근거 확인 완료" })).statusCode, 200);
  assert.equal(store.snapshot().cases[0].status, "확정");
  console.log(JSON.stringify({ tests: 21, aiRecommendationTests: 3, supplementAndFinalizeTests: 5, finalStatus: store.snapshot().cases[0].status, reassignmentStatus: store.snapshot().cases[1].status, rejected: { order: 409, outsideOrganization: 400, wrongDepartment: 403, wrongTemplate: 400, missingReason: 400 }, writes: store.snapshot().writes }, null, 2));
})().catch((error) => { console.error(error); process.exit(1); });
