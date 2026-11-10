"use strict";
const assert = require("node:assert/strict");
const { createHandler } = require("./api/chat.js");
function responseMock() { return { statusCode: 0, headers: {}, setHeader(key, value) { this.headers[key] = value; }, end(value) { this.body = JSON.parse(value); } }; }
async function call(handler, method, body) { const response = responseMock(); await handler({ method, body }, response); return response; }
(async () => {
  const results = [], fallback = createHandler({ apiKey: "", model: "", groqApiKey: "" });
  let response = await call(fallback, "POST", { message: "요구자료 처리 절차 알려줘" }); assert.equal(response.statusCode, 200); assert.equal(response.body.mode, "서버 안내 모드"); assert.match(response.body.answer, /접수.*문항 분해.*배분/); results.push("키 없이 서버 안내 답변");
  response = await call(fallback, "POST", { message: "" }); assert.equal(response.statusCode, 400); results.push("빈 질문 400 차단");
  response = await call(fallback, "POST", { message: "가".repeat(1001) }); assert.equal(response.statusCode, 400); results.push("1000자 초과 400 차단");
  response = await call(fallback, "GET", null); assert.equal(response.statusCode, 405); results.push("POST 외 405 차단");
  let upstreamRequest;
  const ai = createHandler({ apiKey: "test-secret-not-real", model: "test-model", groqApiKey: "", fetch: async (url, options) => { upstreamRequest = { url, options, payload: JSON.parse(options.body) }; return { ok: true, status: 200, async json() { return { output: [{ content: [{ type: "output_text", text: "테스트 AI 답변" }] }] }; } }; } });
  response = await call(ai, "POST", JSON.stringify({ message: "배분은 누가 확정하나요?", ignored: "저장 금지" })); assert.equal(response.statusCode, 200); assert.equal(response.body.answer, "테스트 AI 답변"); assert.equal(response.body.mode, "OpenAI Responses API"); assert.equal(upstreamRequest.url, "https://api.openai.com/v1/responses"); assert.equal(upstreamRequest.payload.store, false); assert.equal(upstreamRequest.payload.model, "test-model"); assert.equal(JSON.stringify(upstreamRequest.payload).includes("저장 금지"), false); assert.equal(JSON.stringify(response.body).includes("test-secret-not-real"), false); results.push("Responses API 요청·비저장·비밀값 비노출");
  let groqRequest;
  const groq = createHandler({ apiKey: "", model: "", groqApiKey: "groq-test-secret-not-real", groqModel: "openai/gpt-oss-20b", fetch: async (url, options) => { groqRequest = { url, options, payload: JSON.parse(options.body) }; return { ok: true, status: 200, async json() { return { choices: [{ message: { content: "무료 LLM 테스트 답변" } }] }; } }; } });
  response = await call(groq, "POST", { message: "배분 절차를 알려줘", ignored: "외부 전송 금지" }); assert.equal(response.statusCode, 200); assert.equal(response.body.answer, "무료 LLM 테스트 답변"); assert.equal(response.body.mode, "Groq 무료 LLM"); assert.equal(groqRequest.url, "https://api.groq.com/openai/v1/chat/completions"); assert.equal(groqRequest.payload.model, "openai/gpt-oss-20b"); assert.equal(groqRequest.payload.temperature, .2); assert.equal(JSON.stringify(groqRequest.payload).includes("외부 전송 금지"), false); assert.equal(JSON.stringify(response.body).includes("groq-test-secret-not-real"), false); results.push("Groq 무료 LLM 요청·비밀값 비노출");
  const groqAuthFailure = createHandler({ apiKey: "", model: "", groqApiKey: "groq-test-secret-not-real", fetch: async () => ({ ok: false, status: 401, async json() { return { error: { message: "민감한 외부 오류 본문" } }; } }) });
  response = await call(groqAuthFailure, "POST", { message: "공개 데모 질문" }); assert.equal(response.statusCode, 502); assert.equal(response.body.provider, "Groq"); assert.equal(response.body.providerStatus, 401); assert.match(response.body.error, /인증 정보/); assert.equal(JSON.stringify(response.body).includes("groq-test-secret-not-real"), false); assert.equal(JSON.stringify(response.body).includes("민감한 외부 오류 본문"), false); results.push("Groq 오류 원인 구분·외부 본문 비노출");
  console.log(JSON.stringify({ passed: results.length, results }, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; });

