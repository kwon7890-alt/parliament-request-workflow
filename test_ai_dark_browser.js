"use strict";
const fs = require("node:fs"), path = require("node:path"), { chromium } = require("playwright");
const pages = ["index.html", "assign.html", "dept.html", "collect.html", "chat.html"];
const seed = [{ id: "ui-1", source: "가상.pdf", committee: "외교통일위원회", member: "의원A", dueDate: "2026-10-13", questionNumber: "1", requirement: "가상 요구자료", status: "배분확정", candidates: [], leadDepartment: "운영지원과", supportDepartments: [], confirmationMethod: "수정", replies: {}, supplements: {}, history: [{ action: "접수", at: "2026-11-10T01:00:00.000Z" }, { action: "배분", at: "2026-11-10T02:00:00.000Z", leadDepartment: "운영지원과" }] }];

function luminance(hex) {
  const rgb = hex.replace("#", "").match(/.{2}/g).map((value) => parseInt(value, 16) / 255).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
}
function contrast(a, b) { const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x); return (light + .05) / (dark + .05); }

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" });
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript((cases) => localStorage.setItem("parliament-cases-v03", JSON.stringify(cases)), seed);
    const outputDir = path.join(__dirname, "검증결과", "AI블랙UI"); fs.mkdirSync(outputDir, { recursive: true });
    const results = [];
    for (const file of pages) {
      const page = await context.newPage(), errors = [];
      page.on("pageerror", (error) => errors.push(error.message)); page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
      await page.goto(`http://localhost:8000/${file}`, { waitUntil: "networkidle" });
      await page.waitForFunction(() => document.documentElement.dataset.aiUi === "black-surface-v2");
      const info = await page.evaluate(() => ({
        title: document.title,
        themeMeta: document.querySelector('meta[name="color-scheme"]')?.content,
        themeColor: document.querySelector('meta[name="theme-color"]')?.content,
        stylesheet: [...document.styleSheets].some((sheet) => sheet.href?.endsWith("/ai-dark.css")),
        dataset: document.documentElement.dataset.aiUi,
        bodyBackground: getComputedStyle(document.body).backgroundColor,
        ink: getComputedStyle(document.documentElement).getPropertyValue("--ink").trim(),
        muted: getComputedStyle(document.documentElement).getPropertyValue("--muted").trim(),
        bg: getComputedStyle(document.documentElement).getPropertyValue("--bg").trim(),
        glass: CSS.supports("backdrop-filter", "blur(1px)"),
        viewTransition: typeof document.startViewTransition === "function",
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      }));
      results.push({ file, ...info, errors });
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 600) {
          window.scrollTo(0, y);
          await new Promise((resolve) => setTimeout(resolve, 35));
        }
        window.scrollTo(0, 0);
      });
      await page.screenshot({ path: path.join(outputDir, file.replace(".html", ".png")), fullPage: true });
      await page.close();
    }
    const mobile = await context.newPage(); await mobile.setViewportSize({ width: 390, height: 844 }); await mobile.goto("http://localhost:8000/index.html", { waitUntil: "networkidle" });
    const mobileOverflow = await mobile.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1); await mobile.screenshot({ path: path.join(outputDir, "index-mobile.png"), fullPage: true }); await mobile.close();
    const ratios = { normalText: Number(contrast("#f5f7fb", "#050607").toFixed(2)), mutedText: Number(contrast("#aeb8c7", "#050607").toFixed(2)) };
    const reducedContext = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: "reduce" });
    const reducedPage = await reducedContext.newPage(); await reducedPage.goto("http://localhost:8000/index.html", { waitUntil: "networkidle" });
    const reducedMotion = await reducedPage.evaluate(() => ({
      spotlightHidden: getComputedStyle(document.querySelector(".panel"), "::after").display === "none",
      smoothScrollDisabled: getComputedStyle(document.documentElement).scrollBehavior === "auto",
    }));
    await reducedContext.close();
    if (results.some((item) => item.themeMeta !== "dark" || item.themeColor !== "#050607" || !item.stylesheet || item.dataset !== "black-surface-v2" || item.overflow || item.errors.length) || mobileOverflow || ratios.normalText < 4.5 || ratios.mutedText < 4.5 || !reducedMotion.spotlightHidden) throw new Error(JSON.stringify({ results, mobileOverflow, ratios, reducedMotion }));
    console.log(JSON.stringify({ pages: results, mobileOverflow, ratios, reducedMotion }, null, 2));
  } finally { await browser?.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
