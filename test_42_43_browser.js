"use strict";
const fs = require("node:fs"), path = require("node:path"), { chromium } = require("playwright"), XLSX = require("./web/lib/xlsx.full.min.js");

const seed = [
  { id: "k01", member: "의원K", questionNumber: "01", requirement: "가상 운영 현황", dueDate: "2026-10-13", status: "회신중", leadDepartment: "운영지원과", supportDepartments: ["산업정책과"], replies: { 산업정책과: { memo: "회신" } }, history: [
    { action: "배분", at: "2026-10-10T00:00:00.000Z", leadDepartment: "산업정책과" },
    { action: "재배정요청", at: "2026-10-10T01:00:00.000Z", actorDepartment: "산업정책과" },
    { action: "배분", at: "2026-10-10T02:00:00.000Z", leadDepartment: "운영지원과" },
  ] },
  { id: "k04", member: "의원K", questionNumber: "04", requirement: "날짜 확인 자료", dueDate: "날짜 미정", status: "보완요청", leadDepartment: "정보화담당관", supportDepartments: [], replies: { 정보화담당관: { memo: "초안" } }, supplements: { 정보화담당관: { reason: "보완" } }, history: [] },
];

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, acceptDownloads: true }), errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    await page.addInitScript((cases) => localStorage.setItem("parliament-cases-v03", JSON.stringify(cases)), seed);

    await page.goto("http://localhost:8000/index.html", { waitUntil: "networkidle" });
    await page.waitForFunction(() => document.querySelector("#historyCount")?.textContent.includes("3건 / 전체 3건"));
    await page.locator("#historyDepartment").selectOption("산업정책과");
    await page.waitForFunction(() => document.querySelector("#historyCount")?.textContent.startsWith("2건"));
    await page.locator("#historyDepartment").selectOption("");
    await page.locator("#historyQuestion").fill("의원K-01");
    await page.waitForFunction(() => document.querySelector("#historyCount")?.textContent.startsWith("3건"));
    const historyDownload = await Promise.all([page.waitForEvent("download"), page.locator("#exportHistory").click()]).then(([download]) => download);
    const outputDir = path.join(__dirname, "검증결과"); fs.mkdirSync(outputDir, { recursive: true });
    const historyPath = path.join(outputDir, "처리기록_국회요구자료.xlsx"); await historyDownload.saveAs(historyPath);
    const historyBook = XLSX.read(fs.readFileSync(historyPath), { type: "buffer" }), historySheet = XLSX.utils.sheet_to_json(historyBook.Sheets.처리기록);

    await page.goto("http://localhost:8000/collect.html", { waitUntil: "networkidle" });
    await page.locator("#deadlineTab").click();
    await page.locator("#deadlineBase").fill("2026-10-12");
    await page.locator("#deadlineDays").fill("2");
    await page.waitForFunction(() => document.querySelector("#deadlineSummary")?.textContent.includes("대상 1건 · 1개 과"));
    const d1 = await page.locator("#deadlineRows").innerText(), review = await page.locator("#deadlineReviewRows").innerText();
    await page.locator("#deadlineBase").fill("2026-10-08");
    await page.waitForFunction(() => document.querySelector("#deadlineSummary")?.textContent.includes("대상 0건"));
    const zero = await page.locator("#deadlineSummary").textContent();
    await page.locator("#deadlineBase").fill("2026-10-16");
    await page.waitForFunction(() => document.querySelector("#deadlineRows")?.textContent.includes("기한 경과"));
    const deadlineDownload = await Promise.all([page.waitForEvent("download"), page.locator("#exportDeadlineXlsx").click()]).then(([download]) => download);
    const deadlinePath = path.join(outputDir, "독촉목록_국회요구자료.xlsx"); await deadlineDownload.saveAs(deadlinePath);
    const deadlineBook = XLSX.read(fs.readFileSync(deadlinePath), { type: "buffer" }), deadlineRows = XLSX.utils.sheet_to_json(deadlineBook.Sheets.독촉목록), reviewRows = XLSX.utils.sheet_to_json(deadlineBook.Sheets.확인필요);
    const textDownload = await Promise.all([page.waitForEvent("download"), page.locator("#exportDeadlineText").click()]).then(([download]) => download);
    const textPath = path.join(outputDir, "과별_회신기한_안내문.txt"); await textDownload.saveAs(textPath);
    const notice = fs.readFileSync(textPath, "utf8");
    await page.screenshot({ path: path.join(outputDir, "42-43쪽_웹검증.png"), fullPage: true });

    const result = { historyFiltered: 3, historyExcelRows: historySheet.length, kst: historySheet[0]?.일시, d1: /D-1/.test(d1), zero, overdue: deadlineRows[0]?.구분, deadlineExcelRows: deadlineRows.length, reviewExcelRows: reviewRows.length, reviewVisible: /확인필요/.test(review) || /날짜/.test(review), noticeRecipient: /수신: 운영지원과/.test(notice), errors };
    if (result.historyExcelRows !== 3 || !/^2026-10-10 /.test(result.kst) || !result.d1 || !result.zero.includes("0건") || result.overdue !== "기한 경과" || result.deadlineExcelRows !== 1 || result.reviewExcelRows !== 1 || !result.noticeRecipient || result.errors.length) throw new Error(JSON.stringify(result));
    console.log(JSON.stringify(result, null, 2));
  } finally { await browser?.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
