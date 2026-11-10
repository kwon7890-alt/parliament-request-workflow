"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const sourcePath = path.join(root, "data", "A부_조직도_26개과.csv");
const outputPath = path.join(root, "org.json");
const requiredHeaders = ["실국", "과", "대표키워드"];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"' && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }

  if (quoted) {
    throw new Error("CSV의 따옴표가 닫히지 않았습니다.");
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((values) => values.some((value) => value.trim() !== ""));
}

function main() {
  const text = fs.readFileSync(sourcePath, "utf8").replace(/^\uFEFF/, "");
  const [headers, ...records] = parseCsv(text);
  if (!headers) {
    throw new Error("CSV에 머리글이 없습니다.");
  }

  const positions = Object.fromEntries(headers.map((header, index) => [header.trim(), index]));
  const missing = requiredHeaders.filter((header) => positions[header] === undefined);
  if (missing.length > 0) {
    throw new Error(`필수 열이 없습니다: ${missing.join(", ")}`);
  }

  const organizations = records.map((record, index) => {
    const bureau = (record[positions["실국"]] ?? "").trim();
    const department = (record[positions["과"]] ?? "").trim();
    if (!bureau || !department) {
      throw new Error(`${index + 2}행의 실국 또는 과가 비어 있습니다.`);
    }
    return {
      실국: bureau,
      과: department,
      대표키워드: (record[positions["대표키워드"]] ?? "")
        .split("|")
        .map((keyword) => keyword.trim())
        .filter(Boolean),
    };
  });

  fs.writeFileSync(outputPath, `${JSON.stringify(organizations, null, 2)}\n`, "utf8");
  console.log(`원소 수: ${organizations.length}`);
  console.log("첫 원소:");
  console.log(JSON.stringify(organizations[0], null, 2));
}

main();
