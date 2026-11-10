import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const splitter = require("./web/split.js");
const common = require("./web/common.js");
const engine = require("./web/engine.js");
const root = path.dirname(fileURLToPath(import.meta.url));
const pdfModulePath = path.join(
  process.env.USERPROFILE,
  ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/pdfjs-dist/legacy/build/pdf.mjs",
);
const pdfjs = await import(pathToFileURL(pdfModulePath).href);

function read(relative) {
  return fs.readFileSync(path.join(root, relative), "utf8");
}

async function extract(filePath) {
  const document = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(filePath)), disableWorker: true }).promise;
  const lines = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    let line = "";
    for (const item of content.items) {
      line += `${line ? " " : ""}${item.str}`;
      if (item.hasEOL) { if (line.trim()) lines.push(line.trim()); line = ""; }
    }
    if (line.trim()) lines.push(line.trim());
  }
  return lines;
}

const pdfNames = fs.readdirSync(path.join(root, "원문")).filter((name) => name.endsWith(".pdf")).sort();
const rows = [], summaries = [];
for (const name of pdfNames) {
  const result = splitter.parseLines(name, await extract(path.join(root, "원문", name)));
  rows.push(...result.rows);
  summaries.push(result.summary);
}

const expected = common.parseCsv(read("data/문항목록.csv"));
const fields = ["파일명", "위원회", "의원", "제출기한", "문항번호", "요구내용", "세부항목", "비고"];
const differences = [];
for (let index = 0; index < Math.max(rows.length, expected.length); index += 1) {
  for (const field of fields) {
    if ((rows[index]?.[field] ?? "") !== (expected[index]?.[field] ?? "")) differences.push({ row: index + 2, field });
  }
}

const personalPattern = /수신:|담당 보좌관:|[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}|(^|\D)\d{2,3}-\d{3,4}-\d{4}(?!\d)/;
const privacyHits = rows.filter((row) => personalPattern.test(fields.map((field) => row[field]).join("\n"))).length;
await engine.initialize({ rulesPath: path.join(root, "web/data/rules_보강.csv"), organizationPath: path.join(root, "web/data/A부_조직도_26개과.csv") });
const organizations = common.parseCsv(read("web/data/A부_조직도_26개과.csv"));
const storage = common.createMemoryStorage();
const registered = common.registerCases(rows, storage, () => "2026-11-10T00:00:00.000Z");
for (const item of registered.cases) common.setCandidates(item.id, engine.classify(item.requirement), storage);
const afterCandidates = common.loadCases(storage);
const candidateCounts = afterCandidates.reduce((counts, item) => { counts[item.candidates.length] = (counts[item.candidates.length] ?? 0) + 1; return counts; }, {});
const confirmable = afterCandidates.filter((item) => item.candidates.length).slice(0, 2);
for (const item of confirmable) {
  common.confirmAssignment(item.id, { leadDepartment: item.candidates[0].과, supportDepartments: item.candidates[1] ? [item.candidates[1].과] : [], confirmationMethod: "규칙" }, organizations, storage, () => "2026-11-10T00:01:00.000Z");
}
const finalCases = common.loadCases(storage);
const assigned = finalCases.filter((item) => item.status === "배분확정");
const invalidDepartments = finalCases.flatMap((item) => [item.leadDepartment, ...item.supportDepartments]).filter(Boolean).filter((department) => !organizations.some((item) => item.과 === department));

const result = {
  pdfs: summaries,
  total: rows.length,
  exactCsvDifferences: differences.length,
  privacyHits,
  casesSaved: finalCases.length,
  candidateCounts,
  confirmed: assigned.length,
  confirmationHistory: assigned.every((item) => item.history.some((entry) => entry.action === "배분확정")),
  invalidDepartments: invalidDepartments.length,
};
console.log(JSON.stringify(result, null, 2));
if (!summaries.every((item) => item.일치) || rows.length !== 78 || differences.length || privacyHits || finalCases.length !== 78 || assigned.length !== 2 || invalidDepartments.length) process.exit(1);
