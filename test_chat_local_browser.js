"use strict";
const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe" });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } }), errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("http://localhost:8000/chat.html", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "배분은 누가 확정하나요?" }).click();
  await page.waitForFunction(() => !document.querySelector("#typingMessage") && document.querySelectorAll(".message.assistant").length === 2);
  const result = {
    answer: await page.locator(".message.assistant").last().innerText(),
    mode: await page.locator("#apiMode").innerText(),
    errorMessages: await page.locator(".message.error").count(),
    errors,
  };
  await browser.close();
  if (!result.answer.includes("국회 총괄 담당자") || !result.mode.includes("로컬 안내 모드") || result.errorMessages || result.errors.length) throw new Error(JSON.stringify(result));
  console.log(JSON.stringify(result, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; });
