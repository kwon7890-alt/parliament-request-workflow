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
  await page.waitForFunction(() => document.querySelector("#globe3d")?.dataset.renderer === "canvas-3d" && document.querySelector("#globe3d").width > 0);
  await page.waitForFunction(() => Number(document.querySelector("#ontologyGraph")?.dataset.frame) > 4);
  const pulseCard = page.locator(".pulse-card");
  const cardBox = await pulseCard.boundingBox();
  await page.mouse.move(cardBox.x + cardBox.width * .8, cardBox.y + cardBox.height * .25);
  const tiltTransform = await pulseCard.evaluate((element) => element.style.transform);
  const ontologyCanvas = page.locator("#ontologyGraph");
  await ontologyCanvas.scrollIntoViewIfNeeded();
  const ontologyState = await page.evaluate(() => window.OntologyMap.inspect());
  const ontologyBox = await ontologyCanvas.boundingBox();
  await page.mouse.move(ontologyBox.x + ontologyState.sample.x, ontologyBox.y + ontologyState.sample.y);
  await page.waitForFunction(() => document.querySelector("#ontologyTooltip")?.classList.contains("on"));
  const result = {
    title: await page.title(),
    agency: await page.locator(".brand-copy b").textContent(),
    committeeHeading: await page.locator(".committee-hero h1").innerText(),
    members: await page.locator(".member").count(),
    workflowLinks: await page.locator(".work-links > a").count(),
    chartLibrary: await page.evaluate(() => typeof Chart),
    chartCanvas: await page.locator("#statusChart").count(),
    globeCanvas: await page.locator("#globe3d").count(),
    globeRenderer: await page.locator("#globe3d").getAttribute("data-renderer"),
    globeMotion: await page.locator("#globe3d").getAttribute("data-motion"),
    tiltTransform,
    ontologyRenderer: await ontologyCanvas.getAttribute("data-renderer"),
    ontologyNodes: Number(await ontologyCanvas.getAttribute("data-nodes")),
    ontologyLinks: Number(await ontologyCanvas.getAttribute("data-links")),
    ontologyTooltip: await page.locator("#ontologyTooltip").getAttribute("class"),
    mode: await page.locator("#mode").textContent(),
    errors,
  };
  fs.mkdirSync(path.join(__dirname, "검증결과"), { recursive: true });
  await page.locator(".ontology-panel").screenshot({ path: path.join(__dirname, "검증결과", "ISSUE_ONTOLOGY_관계도.png") });
  await page.mouse.move(1, 1);
  await page.evaluate(() => { scrollTo(0, 0); document.querySelectorAll("[data-reveal],[data-stagger]").forEach((element) => element.classList.add("show")); });
  await page.screenshot({ path: path.join(__dirname, "검증결과", "외통위_메인화면.png"), fullPage: true });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => document.querySelector("#globe3d")?.dataset.motion === "static");
  result.reducedMotion = await page.locator("#globe3d").getAttribute("data-motion");
  result.ontologyReducedMotion = await page.locator("#ontologyGraph").getAttribute("data-motion");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  result.mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  await page.screenshot({ path: path.join(__dirname, "검증결과", "외통위_메인화면_모바일.png"), fullPage: true });
  await browser.close();
  if (result.agency !== "0000청" || !result.committeeHeading.includes("외교통일위원회") || result.members !== 8 || result.workflowLinks !== 3 || result.chartLibrary !== "function" || result.chartCanvas !== 1 || result.globeCanvas !== 1 || result.globeRenderer !== "canvas-3d" || result.globeMotion !== "animated" || result.reducedMotion !== "static" || !result.tiltTransform.includes("rotateX") || result.ontologyRenderer !== "force-ontology" || result.ontologyNodes < 25 || result.ontologyLinks < 30 || !result.ontologyTooltip.includes("on") || result.ontologyReducedMotion !== "static" || result.mobileOverflow || result.errors.length) throw new Error(JSON.stringify(result));
  console.log(JSON.stringify(result, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; });
