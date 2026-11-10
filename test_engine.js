"use strict";

const fs = require("node:fs");
const path = require("node:path");
const engine = require("./web/engine.js");

const root = __dirname;
const testPath = path.join(root, "data", "시험_요구문항_40건.csv");
const suppliedRulesPath = process.argv[2] ? path.resolve(process.argv[2]) : "";
const reportPath = path.join(
  root,
  suppliedRulesPath ? "engine_시험결과_보강.md" : "engine_시험결과.md",
);

function escapeCell(value) {
  return String(value ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function formatCandidates(candidates) {
  if (candidates.length === 0) return "후보 없음";
  return candidates
    .map(
      (candidate, index) =>
        `${index + 1}. ${candidate.과} (${candidate.점수}; ${candidate.근거키워드.join(", ")})`,
    )
    .join(" / ");
}

async function main() {
  const loaded = await engine.initialize(
    suppliedRulesPath ? { rulesPath: suppliedRulesPath } : {},
  );
  const tests = engine.parseCsv(fs.readFileSync(testPath, "utf8"));
  let top1Correct = 0;
  let top3Correct = 0;
  const wrong = [];

  for (const test of tests) {
    const candidates = engine.classify(test["요구내용"]);
    const answer = test["정답_배분과"].trim();
    const departments = candidates.map((candidate) => candidate.과);
    const top1Match = departments[0] === answer;
    const top3Match = departments.includes(answer);
    top1Correct += Number(top1Match);
    top3Correct += Number(top3Match);
    if (!top1Match) {
      wrong.push({
        시험번호: test["시험번호"],
        요구내용: test["요구내용"],
        정답: answer,
        "엔진 결과": formatCandidates(candidates),
      });
    }
  }

  const summary = `1순위 정답 ${top1Correct}/${tests.length} · 3순위 안 ${top3Correct}/${tests.length}`;
  console.log(summary);
  console.log("시험번호 | 요구내용 | 정답 | 엔진 결과");
  console.log("---|---|---|---");
  for (const row of wrong) {
    console.log(
      `${escapeCell(row.시험번호)} | ${escapeCell(row.요구내용)} | ${escapeCell(row.정답)} | ${escapeCell(row["엔진 결과"])}`,
    );
  }

  const report = [
    "# 배분 엔진 시험 결과",
    "",
    "- 배분기준표: [data/배분기준표_소관키워드_304건.csv](data/배분기준표_소관키워드_304건.csv)",
    "- 조직도: [data/A부_조직도_26개과.csv](data/A부_조직도_26개과.csv)",
    "- 시험자료: [data/시험_요구문항_40건.csv](data/시험_요구문항_40건.csv)",
    `- 엔진: [web/engine.js](web/engine.js)`,
    `- 시험 코드: [test_engine.js](test_engine.js)`,
    `- 적용 규칙: ${suppliedRulesPath ? `[rules_보강.csv](rules_보강.csv)` : "[원본 배분기준표](data/배분기준표_소관키워드_304건.csv)"}`,
    "",
    `## ${summary}`,
    "",
    `적재 규칙 ${loaded.ruleCount}건, 조직도 과 ${loaded.departmentCount}개를 사용했다.`,
    "",
    "## 1순위 오답",
    "",
    "| 시험번호 | 요구내용 | 정답 | 엔진 결과 |",
    "|---|---|---|---|",
    ...wrong.map(
      (row) =>
        `| ${escapeCell(row.시험번호)} | ${escapeCell(row.요구내용)} | ${escapeCell(row.정답)} | ${escapeCell(row["엔진 결과"])} |`,
    ),
    "",
  ].join("\n");
  fs.writeFileSync(reportPath, report, "utf8");
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
