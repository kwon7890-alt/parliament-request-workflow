"use strict";

const FlowEngine = require("../web/flow.js");
const organization = require("./org.json");

function send(response, status, body) {
  if (typeof response.status === "function") return response.status(status).json(body);
  response.statusCode = status;
  response.setHeader?.("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

function extractResponseText(body) {
  if (typeof body.output_text === "string") return body.output_text;
  return (body.output ?? []).flatMap((item) => item.content ?? []).filter((item) => item.type === "output_text").map((item) => item.text ?? "").join("\n");
}

async function recommendWithOpenAI(requirement, organization, options = {}) {
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  const model = options.model ?? process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  if (!apiKey) { const error = new Error("OPENAI_API_KEY가 없습니다. Vercel 서버 환경변수에 설정한 뒤 다시 배포하세요."); error.status = 500; throw error; }
  const names = organization.map((item) => item.과).filter(Boolean);
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const response = await fetchImpl("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      store: false,
      instructions: `국회 요구자료의 소관 과 후보를 고른다. 반드시 다음 목록 안에서 최대 3개만 고르고 각 근거를 한 문장으로 쓴다. 적절한 과가 없으면 후보를 비우고 해당없음을 true로 한다. 부서 목록: ${names.join(", ")}`,
      input: [{ role: "user", content: [{ type: "input_text", text: requirement }] }],
      text: { format: { type: "json_schema", name: "department_recommendation", strict: true, schema: { type: "object", additionalProperties: false, properties: { 후보: { type: "array", maxItems: 3, items: { type: "object", additionalProperties: false, properties: { 과: { type: "string" }, 근거: { type: "string" } }, required: ["과", "근거"] } }, 해당없음: { type: "boolean" } }, required: ["후보", "해당없음"] } } },
    }),
  });
  if (!response.ok) { const error = new Error(`OpenAI 응답 오류(${response.status})`); error.status = 502; throw error; }
  const parsed = JSON.parse(extractResponseText(await response.json()) || "{}");
  return parsed;
}

async function createBlobStore() {
  if (!process.env.BLOB_READ_WRITE_TOKEN) throw new Error("BLOB_READ_WRITE_TOKEN 환경변수가 없습니다.");
  const { get, put } = await import("@vercel/blob");
  return {
    async read() {
      try {
        const response = await get("cases.json", { access: "private", useCache: false });
        if (!response) return { cases: [], etag: null };
        const text = typeof response.text === "function" ? await response.text() : await new Response(response.stream ?? response.body).text();
        return { cases: text ? JSON.parse(text) : [], etag: response.etag ?? null };
      } catch (error) {
        if (error?.status === 404 || error?.code === "not_found" || error?.name === "BlobNotFoundError") return { cases: [], etag: null };
        throw error;
      }
    },
    async write(cases, etag) {
      return put("cases.json", JSON.stringify(cases), {
        access: "private",
        allowOverwrite: true,
        cacheControlMaxAge: 60,
        contentType: "application/json; charset=utf-8",
        ...(etag ? { ifMatch: etag } : {}),
      });
    },
  };
}

function createHandler(options = {}) {
  let storePromise = options.store ? Promise.resolve(options.store) : null;
  const org = options.organization ?? organization;
  return async function handler(request, response) {
    try {
      const payload = typeof request.body === "string" ? JSON.parse(request.body || "{}") : (request.body ?? {});
      if (request.method === "POST" && payload.action === "AI추천") {
        const requirement = String(payload.requirement ?? payload.요구내용 ?? "").trim().slice(0, 12000);
        if (!requirement) return send(response, 400, { error: "AI 추천할 요구내용이 없습니다." });
        const raw = options.recommend ? await options.recommend(requirement, org) : await recommendWithOpenAI(requirement, org, options);
        const allowed = new Set(org.map((item) => item.과));
        const 후보 = (Array.isArray(raw?.후보) ? raw.후보 : []).filter((item) => allowed.has(item?.과)).slice(0, 3).map((item) => ({ 과: item.과, 근거: String(item.근거 ?? "").trim().slice(0, 500) }));
        return send(response, 200, { 후보, 해당없음: Boolean(raw?.해당없음 || !후보.length), mode: "AI 추천·사람 확정" });
      }
      const store = await (storePromise ||= createBlobStore());
      if (request.method === "GET") {
        const snapshot = await store.read();
        return send(response, 200, { cases: snapshot.cases, mode: "Vercel Blob 공유 저장" });
      }
      if (request.method !== "POST") return send(response, 405, { error: "GET과 POST만 사용할 수 있습니다." });
      const snapshot = await store.read();
      const outcome = FlowEngine.apply(snapshot.cases, payload, org);
      await store.write(outcome.db, snapshot.etag);
      return send(response, 200, { cases: outcome.db, result: outcome.result, mode: "Vercel Blob 공유 저장" });
    } catch (error) {
      const status = Number(error.status) || (error.name === "BlobPreconditionFailedError" ? 409 : 500);
      const message = status === 500 && !String(error.message).startsWith("OPENAI_API_KEY") ? "서버 저장 중 오류가 발생했습니다." : error.message;
      return send(response, status, { error: message });
    }
  };
}

const handler = createHandler();
module.exports = handler;
module.exports.createHandler = createHandler;
module.exports.createBlobStore = createBlobStore;
module.exports.recommendWithOpenAI = recommendWithOpenAI;
