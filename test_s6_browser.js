"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { chromium } = require("playwright");

const root = __dirname;
const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex").toUpperCase();

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("http://localhost:8000/assign.html", { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  const pdfs = fs.readdirSync(path.join(root, "원문")).filter((name) => name.endsWith(".pdf")).sort().map((name) => path.join(root, "원문", name));
  await page.setInputFiles("#pdfFiles", pdfs);
  await page.waitForFunction(() => document.querySelector("#notice")?.textContent.includes("78문항"), null, { timeout: 30000 });
  await page.click("#register");
  await page.waitForFunction(() => document.querySelector("#totalCount")?.textContent === "78");
  const pastHistoryCases = await page.locator("#caseRows tr[data-id]").evaluateAll((rows) => rows.filter((row) => /과거 \d+건/.test(row.innerText)).length);
  const firstRow = page.locator("#caseRows tr[data-id]").first();
  const department = await firstRow.locator(".lead").inputValue();
  await firstRow.locator("button.confirm").click();
  await page.waitForFunction(() => document.querySelector("#assignedCount")?.textContent === "1");

  await page.goto("http://localhost:8000/dept.html", { waitUntil: "networkidle" });
  await page.selectOption("#department", department);
  await page.waitForFunction(() => document.querySelectorAll("#cards .case").length > 0);
  const card = page.locator("#cards .case").first();
  await card.locator(".memo").fill("공식 답변양식에 옮겨 작성할 검증 회신입니다.");
  const replyFile = fs.readdirSync(path.join(root, "부서회신")).find((name) => name.endsWith(".xlsx"));
  await card.locator(".reply-file").setInputFiles(path.join(root, "부서회신", replyFile));
  await card.locator(".submit").click();
  await page.waitForFunction(() => document.querySelector("#notice")?.textContent.includes("회신을 저장"));
  await page.waitForFunction(() => document.querySelector("#cards .status")?.textContent === "회신완료");
  const deptTemplateLinks = await page.locator('a[download][href$=".hwp"]').count();
  fs.mkdirSync(path.join(root, "검증결과"), { recursive: true });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(root, "검증결과", "S6_현업회신_공식양식.png"), fullPage: true });

  await page.goto("http://localhost:8000/collect.html", { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__casesTable?.getDataCount() === 78);
  const collectTemplateHrefs = await page.locator('a[download]').evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: path.join(root, "검증결과", "S6_취합현황_공식양식.png"), fullPage: true });
  const result = {
    total: await page.evaluate(() => window.__casesTable.getDataCount()),
    pastHistoryCases,
    department,
    finalStatus: await page.locator("#casesTable .status.done").first().textContent(),
    tableEngine: await page.locator("#casesTable").getAttribute("data-engine"),
    tabulatorLibrary: await page.evaluate(() => typeof Tabulator),
    deptTemplateLinks,
    collectTemplateLinks: collectTemplateHrefs,
    onlyOfficialHwp: collectTemplateHrefs.length === 2 && collectTemplateHrefs.every((href) => href.endsWith(".hwp")),
    answerTemplateHash: sha256(path.join(root, "web", "templates", "[답변양식]00번_ㅇㅇㅇㅇ과_요청일자_의원명_질의제목.hwp")),
    approvalTemplateHash: sha256(path.join(root, "web", "templates", "[국장결재양식]결재일자_국장결재양식.hwp")),
    consoleErrors: errors,
  };
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  if (result.total !== 78 || result.pastHistoryCases !== 58 || result.finalStatus !== "회신완료" || result.tableEngine !== "Tabulator" || result.tabulatorLibrary !== "function" || result.deptTemplateLinks < 2 || !result.onlyOfficialHwp || result.answerTemplateHash !== "71F474A79151FB4D0A1FD4F0D5963929162D858EE4BD2DBDF4890700E33650D7" || result.approvalTemplateHash !== "0A7E0813F0F9C39CFE05FF06FC0F6FE0443E6B66481030A06E31D0E0275341D6" || result.consoleErrors.length) process.exit(1);
})().catch((error) => { console.error(error); process.exit(1); });
