"use strict";
const assert = require("node:assert/strict");
const HistoryLog = require("./web/history-log.js");
const Deadline = require("./web/deadline.js");

const cases = [
  { id: "k01", member: "의원K", questionNumber: "01", requirement: "가상 운영 현황", dueDate: "2026-10-13", status: "회신중", leadDepartment: "운영지원과", supportDepartments: ["산업정책과"], replies: { 산업정책과: { memo: "회신" } }, history: [
    { action: "배분", at: "2026-10-10T00:00:00.000Z", leadDepartment: "산업정책과" },
    { action: "재배정요청", at: "2026-10-10T01:00:00.000Z", actorDepartment: "산업정책과" },
    { action: "배분", at: "2026-10-10T02:00:00.000Z", leadDepartment: "운영지원과" },
  ] },
  { id: "k02", member: "의원K", questionNumber: "02", requirement: "가상 만료 자료", dueDate: "2026-10-10", status: "배분확정", leadDepartment: "운영지원과", supportDepartments: [], replies: {}, history: [{ action: "접수", at: "2026-10-09T15:00:00.000Z" }] },
  { id: "k03", member: "의원K", questionNumber: "03", requirement: "가상 확정 자료", dueDate: "2026-10-12", status: "확정", leadDepartment: "운영지원과", supportDepartments: [], replies: {}, history: [{ action: "확정", at: "2026-10-12T03:00:00.000Z" }] },
  { id: "k04", member: "의원K", questionNumber: "04", requirement: "날짜 확인 자료", dueDate: "날짜 미정", status: "보완요청", leadDepartment: "정보화담당관", supportDepartments: [], replies: { 정보화담당관: { memo: "초안" } }, supplements: { 정보화담당관: { reason: "보완" } }, history: [] },
];

const rows = HistoryLog.flatten(cases), questionRows = HistoryLog.filter(rows, { questionPrefix: "의원K-01" }), departmentRows = HistoryLog.filter(rows, { department: "산업정책과" });
assert.equal(questionRows.length, 3);
assert.equal(HistoryLog.sheetRows(questionRows).length, 3);
assert.equal(departmentRows.length, 2);
assert.equal(rows.find((row) => row.작업 === "접수").일시, "2026-10-10 00:00:00");

const d1 = Deadline.collect(cases, "2026-10-12", 2);
assert.equal(d1.targets.find((row) => row.문항 === "의원K-01").구분, "D-1");
assert.equal(d1.targets.find((row) => row.문항 === "의원K-02").구분, "기한 경과");
assert.equal(d1.targets.some((row) => row.문항 === "의원K-03"), false);
assert.equal(d1.review.length, 1);
assert.match(Deadline.noticeText(d1.targets, "국회 총괄 담당"), /수신: 운영지원과/);
assert.equal(Deadline.collect([cases[0]], "2026-10-08", 2).targets.length, 0);

console.log(JSON.stringify({ historyRows: rows.length, questionPrefixRows: questionRows.length, departmentRows: departmentRows.length, deadlineTargets: d1.targets.length, deadlineDepartments: d1.departmentCount, review: d1.review.length, zeroTarget: 0 }, null, 2));
