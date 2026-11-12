"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const pages = ["index.html", "assign.html", "dept.html", "collect.html", "chat.html"];
const seed = [{
  id: "ui-light-1", source: "가상자료.pdf", committee: "외교통일위원회", member: "의원A",
  dueDate: "2026-11-15", questionNumber: "1", requirement: "재외동포 지원사업의 최근 3년 예산과 집행 현황",
  status: "배분확정", candidates: [{ 과: "기획재정담당관", 점수: 3.2, 근거키워드: ["예산"] }],
  leadDepartment: "기획재정담당관", supportDepartments: [], confirmationMethod: "규칙",
  replies: {}, supplements: {}, history: [{ action: "접수", at: "2026-11-12T01:00:00.000Z" }, { action: "배분", at: "2026-11-12T02:00:00.000Z", leadDepartment: "기획재정담당관" }],
}];

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" });
  try {
    const outputDir = path.join(__dirname, "검증결과", "업무형UI");
    fs.mkdirSync(outputDir, { recursive: true });
    const results = [];
    for (const viewport of [{ name: "desktop", width: 1440, height: 1000 }, { name: "mobile", width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport });
      await context.addInitScript((cases) => localStorage.setItem("parliament-cases-v03", JSON.stringify(cases)), seed);
      for (const file of pages) {
        const page = await context.newPage();
        const errors = [];
        page.on("pageerror", (error) => errors.push(error.message));
        page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
        await page.goto(`http://127.0.0.1:8000/${file}`, { waitUntil: "networkidle" });
        await page.waitForFunction(() => document.documentElement.dataset.aiUi === "oka-workflow-light-v3");
        await page.evaluate(async () => {
          for (let y = 0; y < document.body.scrollHeight; y += 540) {
            window.scrollTo(0, y);
            await new Promise((resolve) => setTimeout(resolve, 30));
          }
          window.scrollTo(0, 0);
        });
        await page.screenshot({ path: path.join(outputDir, `${viewport.name}-${file.replace(".html", ".png")}`), fullPage: true });
        const info = await page.evaluate(() => ({
          title: document.title,
          brand: document.querySelector(".brand-copy b")?.textContent,
          safety: document.querySelector(".safety-bar")?.textContent.includes("실자료·개인정보 입력 금지"),
          theme: document.querySelector('meta[name="color-scheme"]')?.content,
          bg: getComputedStyle(document.body).backgroundColor,
          overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
          visibleText: document.body.innerText.trim().length,
        }));
        results.push({ viewport: viewport.name, file, ...info, errors });
        await page.close();
      }
      await context.close();
    }
    const failed = results.filter((item) => item.brand !== "재외동포청" || !item.safety || item.theme !== "light" || item.overflow || item.visibleText < 100 || item.errors.length);
    console.log(JSON.stringify({ pages: results.length, failed, results }, null, 2));
    if (failed.length) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
