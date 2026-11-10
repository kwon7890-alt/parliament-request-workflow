"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" });
  const errors = [];
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("http://localhost:8000/index.html", { waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector("#mode")?.textContent !== "저장 방식 확인 중");
  const result = {
    title: await page.title(),
    agency: await page.locator(".brand-copy b").textContent(),
    committeeHeading: await page.locator(".committee-hero h1").innerText(),
    members: await page.locator(".member").count(),
    workflowLinks: await page.locator(".work-links > a").count(),
    chartLibrary: await page.evaluate(() => typeof Chart),
    chartCanvas: await page.locator("#statusChart").count(),
    mode: await page.locator("#mode").textContent(),
    errors,
  };
  fs.mkdirSync(path.join(__dirname, "검증결과"), { recursive: true });
  await page.screenshot({ path: path.join(__dirname, "검증결과", "외통위_메인화면.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  result.mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  await page.screenshot({ path: path.join(__dirname, "검증결과", "외통위_메인화면_모바일.png"), fullPage: true });
  await browser.close();
  if (result.agency !== "0000청" || !result.committeeHeading.includes("외교통일위원회") || result.members !== 8 || result.workflowLinks !== 3 || result.chartLibrary !== "function" || result.chartCanvas !== 1 || result.mobileOverflow || result.errors.length) throw new Error(JSON.stringify(result));
  console.log(JSON.stringify(result, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; });
