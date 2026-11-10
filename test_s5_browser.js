"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://localhost:8000/assign.html", { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  const currentNavTag = await page.locator('.nav [aria-current="page"]').evaluate((element) => element.tagName);
  const resetButtons = await page.locator("#resetAll, #resetCases").count();
  const pdfs = fs.readdirSync(path.join(__dirname, "원문")).filter((name) => name.endsWith(".pdf")).sort().map((name) => path.join(__dirname, "원문", name));
  await page.setInputFiles("#pdfFiles", pdfs);
  await page.waitForFunction(() => document.querySelector("#notice")?.textContent.includes("78문항"), null, { timeout: 30000 });
  const summaryRows = await page.locator("#splitSummary tbody tr").count();
  await page.click("#register");
  await page.waitForFunction(() => document.querySelector("#totalCount")?.textContent === "78");
  await page.fill("#textFilter", "의원 K");
  await page.waitForFunction(() => document.querySelectorAll("#caseRows tr[data-id]").length > 0);
  const fuzzyRows = await page.locator("#caseRows tr[data-id]").count();
  await page.fill("#textFilter", "");
  await page.waitForFunction(() => document.querySelectorAll("#caseRows tr[data-id]").length === 78);
  const urlBeforeConfirm = page.url();
  for (let index = 0; index < 2; index += 1) {
    await page.locator("button.confirm:not([disabled])").first().click();
    await page.waitForFunction((expected) => document.querySelector("#assignedCount")?.textContent === String(expected), index + 1);
  }
  const urlAfterConfirm = page.url();
  const result = {
    title: await page.title(),
    summaryRows,
    total: Number(await page.locator("#totalCount").textContent()),
    received: Number(await page.locator("#receivedCount").textContent()),
    assigned: Number(await page.locator("#assignedCount").textContent()),
    localCases: await page.evaluate(() => JSON.parse(localStorage.getItem("parliament-cases-v03") || "[]").length),
    currentNavTag,
    resetButtons,
    csvLibrary: await page.evaluate(() => typeof Papa),
    excelLibrary: await page.evaluate(() => typeof XLSX),
    searchEngine: await page.locator("#textFilter").getAttribute("data-engine"),
    fuzzyRows,
    confirmReloaded: urlBeforeConfirm !== urlAfterConfirm,
    consoleErrors: errors,
  };
  const [download] = await Promise.all([page.waitForEvent("download"), page.click("#exportXlsx")]);
  result.exportFile = download.suggestedFilename();
  fs.mkdirSync(path.join(__dirname, "검증결과"), { recursive: true });
  await page.screenshot({ path: path.join(__dirname, "검증결과", "S5_배분화면_78건_2건확정.png"), fullPage: true });
  page.once("dialog", (dialog) => dialog.accept());
  await page.click("#resetCases");
  await page.waitForFunction(() => document.querySelector("#totalCount")?.textContent === "0");
  result.afterReset = Number(await page.locator("#totalCount").textContent());
  result.storageAfterReset = await page.evaluate(() => localStorage.getItem("parliament-cases-v03"));
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  if (result.summaryRows !== 3 || result.total !== 78 || result.received !== 76 || result.assigned !== 2 || result.localCases !== 78 || result.currentNavTag !== "SPAN" || result.resetButtons !== 2 || result.csvLibrary !== "object" || result.excelLibrary !== "object" || result.searchEngine !== "Fuse.js" || result.fuzzyRows < 1 || result.exportFile !== "0000청_외통위_요구자료_처리현황.xlsx" || result.confirmReloaded || result.afterReset !== 0 || result.storageAfterReset !== null || result.consoleErrors.length) process.exit(1);
})().catch((error) => { console.error(error); process.exit(1); });
