"use strict";

const FlowEngine = require("../web/flow.js");
const organization = require("./org.json");

function send(response, status, body) {
  if (typeof response.status === "function") return response.status(status).json(body);
  response.statusCode = status;
  response.setHeader?.("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
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
      const store = await (storePromise ||= createBlobStore());
      if (request.method === "GET") {
        const snapshot = await store.read();
        return send(response, 200, { cases: snapshot.cases, mode: "Vercel Blob 공유 저장" });
      }
      if (request.method !== "POST") return send(response, 405, { error: "GET과 POST만 사용할 수 있습니다." });
      const payload = typeof request.body === "string" ? JSON.parse(request.body || "{}") : (request.body ?? {});
      const snapshot = await store.read();
      const outcome = FlowEngine.apply(snapshot.cases, payload, org);
      await store.write(outcome.db, snapshot.etag);
      return send(response, 200, { cases: outcome.db, result: outcome.result, mode: "Vercel Blob 공유 저장" });
    } catch (error) {
      const status = Number(error.status) || (error.name === "BlobPreconditionFailedError" ? 409 : 500);
      const message = status === 500 ? "서버 저장 중 오류가 발생했습니다." : error.message;
      return send(response, status, { error: message });
    }
  };
}

const handler = createHandler();
module.exports = handler;
module.exports.createHandler = createHandler;
module.exports.createBlobStore = createBlobStore;
