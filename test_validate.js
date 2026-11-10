"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), XLSX = require("./web/lib/xlsx.full.min.js"), Validator = require("./web/validate.js"), Common = require("./web/common.js");
const replyResults = [];
for (const name of fs.readdirSync(path.join(__dirname, "부서회신")).filter((value) => value.endsWith(".xlsx"))) {
  const workbook = XLSX.read(fs.readFileSync(path.join(__dirname, "부서회신", name)), { type: "buffer" });
  const result = Validator.extractReplyWorkbook(workbook, XLSX); replyResults.push({ name, issues: result.issues });
}
const replyIssues = replyResults.flatMap((item) => item.issues.map((issue) => ({ file: item.name, ...issue })));
const registerRows = Common.parseCsv(fs.readFileSync(path.join(__dirname, "data", "검증용_접수대장_120건.csv"), "utf8"));
const organization = Common.parseCsv(fs.readFileSync(path.join(__dirname, "data", "A부_조직도_26개과.csv"), "utf8"));
const registerIssues = Validator.validateRegister(registerRows, organization);
assert.equal(replyIssues.length, 3, JSON.stringify(replyIssues));
assert.deepEqual([...new Set(replyIssues.map((item) => item.type))].sort(), ["연도 누락", "집행액 확인", "합계 불일치"].sort());
const registerRowsWithIssues = new Set(registerIssues.map((item) => item.row)).size;
assert.equal(registerRowsWithIssues, 12, JSON.stringify(registerIssues));
console.log(JSON.stringify({ replyFiles: replyResults.length, replyIssues: replyIssues.length, replyIssueTypes: [...new Set(replyIssues.map((item) => item.type))], registerRows: registerRows.length, registerIssues: registerIssues.length, registerRowsWithIssues }, null, 2));

