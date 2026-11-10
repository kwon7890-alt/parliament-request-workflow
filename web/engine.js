(function (root, factory) {
  "use strict";

  const scriptUrl =
    typeof document !== "undefined" && document.currentScript
      ? document.currentScript.src
      : "";
  const engine = factory(scriptUrl);

  if (typeof module === "object" && module.exports) {
    module.exports = engine;
  } else {
    root.DistributionEngine = engine;
    root.classify = engine.classify;
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function (scriptUrl) {
  "use strict";

  let rules = [];
  let departments = new Set();
  let initialized = false;

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    const source = String(text).replace(/^\uFEFF/, "");

    for (let index = 0; index < source.length; index += 1) {
      const character = source[index];
      if (quoted) {
        if (character === '"' && source[index + 1] === '"') {
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

    if (quoted) throw new Error("CSV의 따옴표가 닫히지 않았습니다.");
    if (field.length > 0 || row.length > 0) {
      row.push(field);
      rows.push(row);
    }

    const nonempty = rows.filter((values) =>
      values.some((value) => value.trim() !== ""),
    );
    if (nonempty.length === 0) return [];

    const headers = nonempty[0].map((header) => header.trim());
    return nonempty.slice(1).map((values) =>
      Object.fromEntries(
        headers.map((header, index) => [header, values[index] ?? ""]),
      ),
    );
  }

  function requireColumns(rows, columns, label) {
    if (rows.length === 0) throw new Error(`${label} CSV에 데이터가 없습니다.`);
    const missing = columns.filter(
      (column) => !Object.prototype.hasOwnProperty.call(rows[0], column),
    );
    if (missing.length > 0) {
      throw new Error(`${label} CSV 필수 열 누락: ${missing.join(", ")}`);
    }
  }

  function normalize(value) {
    return String(value ?? "").toLocaleLowerCase("ko-KR").replace(/\s+/g, " ").trim();
  }

  function loadFromText(rulesCsv, organizationCsv) {
    const ruleRows = parseCsv(rulesCsv);
    const organizationRows = parseCsv(organizationCsv);
    requireColumns(ruleRows, ["과", "키워드", "제외어", "우선순위"], "배분기준표");
    requireColumns(organizationRows, ["과"], "조직도");

    departments = new Set(
      organizationRows.map((row) => row["과"].trim()).filter(Boolean),
    );
    rules = ruleRows
      .map((row, index) => {
        const priority = Number(row["우선순위"]);
        if (!Number.isFinite(priority)) {
          throw new Error(`배분기준표 ${index + 2}행의 우선순위가 숫자가 아닙니다.`);
        }
        return {
          department: row["과"].trim(),
          keyword: normalize(row["키워드"]),
          exclusions: row["제외어"]
            .split("|")
            .map(normalize)
            .filter(Boolean),
          priority,
        };
      })
      .filter((rule) => rule.keyword);

    initialized = true;
    return { ruleCount: rules.length, departmentCount: departments.size };
  }

  async function initialize(options = {}) {
    let rulesCsv;
    let organizationCsv;

    if (typeof module === "object" && module.exports) {
      const fs = require("node:fs");
      const path = require("node:path");
      const rulesPath = options.rulesPath || path.join(__dirname, "..", "data", "배분기준표_소관키워드_304건.csv");
      const organizationPath = options.organizationPath || path.join(__dirname, "..", "data", "A부_조직도_26개과.csv");
      rulesCsv = fs.readFileSync(rulesPath, "utf8");
      organizationCsv = fs.readFileSync(organizationPath, "utf8");
    } else {
      const baseUrl = scriptUrl ? new URL(".", scriptUrl) : new URL("./web/", location.href);
      const rulesUrl = options.rulesUrl || new URL("../data/배분기준표_소관키워드_304건.csv", baseUrl);
      const organizationUrl = options.organizationUrl || new URL("../data/A부_조직도_26개과.csv", baseUrl);
      const [rulesResponse, organizationResponse] = await Promise.all([
        fetch(rulesUrl),
        fetch(organizationUrl),
      ]);
      if (!rulesResponse.ok) throw new Error(`배분기준표를 읽지 못했습니다: ${rulesResponse.status}`);
      if (!organizationResponse.ok) throw new Error(`조직도를 읽지 못했습니다: ${organizationResponse.status}`);
      [rulesCsv, organizationCsv] = await Promise.all([
        rulesResponse.text(),
        organizationResponse.text(),
      ]);
    }

    return loadFromText(rulesCsv, organizationCsv);
  }

  function classify(requirement) {
    if (!initialized) {
      throw new Error("엔진을 먼저 initialize() 해야 합니다.");
    }

    const text = normalize(requirement);
    if (!text) return [];
    const scores = new Map();

    for (const rule of rules) {
      if (!departments.has(rule.department)) continue;
      if (!text.includes(rule.keyword)) continue;
      if (rule.exclusions.some((exclusion) => text.includes(exclusion))) continue;

      if (!scores.has(rule.department)) {
        scores.set(rule.department, { score: 0, keywords: new Set() });
      }
      const entry = scores.get(rule.department);
      entry.score += rule.priority + [...rule.keyword].length / 10;
      entry.keywords.add(rule.keyword);
    }

    return [...scores.entries()]
      .map(([department, value]) => ({
        과: department,
        점수: Number(value.score.toFixed(1)),
        근거키워드: [...value.keywords].sort((left, right) =>
          right.length - left.length || left.localeCompare(right, "ko"),
        ),
      }))
      .sort((left, right) =>
        right.점수 - left.점수 ||
        right.근거키워드[0]?.length - left.근거키워드[0]?.length ||
        left.과.localeCompare(right.과, "ko"),
      )
      .slice(0, 3);
  }

  return { initialize, loadFromText, classify, parseCsv };
});
