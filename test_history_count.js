"use strict";
const fs = require("node:fs");
const engine = require("./web/engine.js");
const read = (file) => fs.readFileSync(file, "utf8");
engine.loadFromText(read("./rules_보강.csv"), read("./data/A부_조직도_26개과.csv"));
const questions = engine.parseCsv(read("./data/문항목록.csv"));
const history = engine.parseCsv(read("./data/요구자료_접수대장_2026국감_520건.csv"));
const counts = { allEvidence: 0, firstEvidence: 0, longestOnly: 0 };
for (const row of questions) {
  const evidence = engine.classify(row.요구내용)[0]?.근거키워드 ?? [];
  if (history.some((past) => evidence.some((word) => word.length >= 2 && past.요구내용.includes(word)))) counts.allEvidence += 1;
  if (evidence[0] && history.some((past) => past.요구내용.includes(evidence[0]))) counts.firstEvidence += 1;
  const longest = evidence.filter((word) => word.length === (evidence[0]?.length ?? 0));
  if (history.some((past) => longest.some((word) => past.요구내용.includes(word)))) counts.longestOnly += 1;
}
console.log(JSON.stringify({ questions: questions.length, ...counts }, null, 2));
