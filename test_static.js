"use strict";

const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    headless: true,
    executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });

  await page.goto("http://127.0.0.1:8010/", { waitUntil: "networkidle" });
  await page.waitForSelector("#wrap table");
  const initial = await page.evaluate(() => ({
    title: document.title,
    heading: document.querySelector("h1")?.textContent,
    environment: document.querySelector(".ai-env")?.textContent,
    tabs: document.querySelectorAll("#tabs .tab").length,
    rows: document.querySelectorAll("#wrap tbody tr").length,
    current: document.querySelector("#ovCurrent")?.textContent,
    mode: document.querySelector("#mode")?.textContent,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
  }));

  await page.locator("#growth").fill("7.5");
  await page.locator("#growth").dispatchEvent("input");
  await page.locator("#save").click();
  await page.waitForFunction(() => localStorage.getItem("oka_budget_flow_v1") !== null);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("oka_budget_flow_v1")));
  await page.reload({ waitUntil: "networkidle" });
  const restoredGrowth = await page.locator("#growth").inputValue();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  await page.screenshot({ path: "검증_정보화예산_숫자판.png", fullPage: true });
  await browser.close();

  const result = { initial, savedGrowth: saved.settings?.growth, restoredGrowth, mobileOverflow, errors };
  if (
    initial.title !== "2028년 정보화예산 편성" ||
    !initial.environment?.includes("Gemma 4 31B") ||
    initial.tabs < 6 || initial.rows < 10 || initial.current !== "2,901" ||
    initial.overflow || saved.settings?.growth !== 7.5 || restoredGrowth !== "7.5" ||
    mobileOverflow || errors.length
  ) throw new Error(JSON.stringify(result));
  console.log(JSON.stringify(result, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; });
