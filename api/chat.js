"use strict";

const MAX_MESSAGE_LENGTH = 1000;
class ProviderServiceError extends Error {
  constructor(provider, providerStatus) {
    super(`${provider} 응답 서비스 오류`);
    this.name = "ProviderServiceError";
    this.provider = provider;
    this.providerStatus = providerStatus;
  }
}
const SYSTEM_INSTRUCTIONS = [
  "당신은 0000청 외교통일위원회 요구자료 대응 업무를 안내하는 보조자다.",
  "접수, 문항 분해, 소관 과 후보 확인, 사람의 최종 배분, 부서 회신, 취합이라는 범위 안에서 짧고 정확하게 답한다.",
  "공식 답변 작성, 결재, 국회 제출을 대신하지 않는다.",
  "소관 과를 임의로 확정하지 말고 접수·배분 화면의 CSV 규칙 결과와 담당자 최종 확인을 안내한다.",
  "이름, 연락처, 비밀번호, API 키 등 개인정보나 비밀값을 요구하거나 재출력하지 않는다.",
].join(" ");

const FAQ = [
  { keys: ["처리", "절차"], answer: "업무 흐름은 요구서 접수 → 문항 분해 → 소관 과 후보 추천 → 국회 총괄 담당자의 배분 확정 → 현업 담당자의 회신 → 총괄 취합 순서입니다. 공식 답변 작성·결재·제출은 이 도구의 자동 처리 범위 밖입니다." },
  { keys: ["배분", "확정"], answer: "배분 엔진은 배분기준표 CSV와 조직도 26개 과를 근거로 후보를 제시합니다. 최종 주관·협조 과는 국회 총괄 담당자가 근거와 업무 경계를 확인한 뒤 확정해야 합니다." },
  { keys: ["api", "키"], answer: "API 키는 화면 코드에 넣지 않습니다. Vercel 프로젝트의 서버 환경변수 OPENAI_API_KEY에 저장하고, 사용할 모델명은 OPENAI_MODEL에 따로 설정합니다." },
  { keys: ["회신", "양식"], answer: "현업 회신과 취합 결과물은 0000청 공식 답변양식과 국장결재양식만 사용합니다. 답변의 사실·수치·근거는 담당자가 확인해야 합니다." },
  { keys: ["개인", "정보"], answer: "수신인, 보좌관 이름, 연락처 같은 값은 문항에 저장하지 않습니다. 공개 저장소와 화면 코드에도 API 키·비밀번호·실제 개인정보를 넣으면 안 됩니다." },
];

function send(response, status, body) {
  if (typeof response.status === "function") return response.status(status).json(body);
  response.statusCode = status;
  response.setHeader?.("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(body));
}

function parseBody(request) {
  if (typeof request.body === "string") return JSON.parse(request.body || "{}");
  return request.body ?? {};
}

function fallbackAnswer(message) {
  const normalized = message.toLowerCase();
  const matched = FAQ.find((item) => item.keys.every((key) => normalized.includes(key)));
  if (matched) return matched.answer;
  return "현재는 서버 안내 모드입니다. ‘요구자료 처리 절차’, ‘배분은 누가 확정하나요?’, ‘API 키는 어디에 두나요?’처럼 공통 툴의 사용 방법을 질문해 주세요. 공식 답변 작성과 최종 배분 판단은 담당자가 수행합니다.";
}

function extractOutput(body) {
  if (typeof body.output_text === "string" && body.output_text.trim()) return body.output_text.trim();
  return (body.output ?? []).flatMap((item) => item.content ?? []).filter((item) => item.type === "output_text" && typeof item.text === "string").map((item) => item.text.trim()).filter(Boolean).join("\n");
}

async function requestOpenAI(message, options) {
  const response = await options.fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "authorization": `Bearer ${options.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({ model: options.model, store: false, instructions: SYSTEM_INSTRUCTIONS, input: [{ role: "user", content: [{ type: "input_text", text: message }] }] }),
  });
  if (!response.ok) throw new ProviderServiceError("OpenAI", response.status);
  const answer = extractOutput(await response.json());
  if (!answer) throw new Error("AI 응답 내용이 비어 있습니다.");
  return answer;
}

async function requestGroq(message, options) {
  const response = await options.fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "authorization": `Bearer ${options.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: options.model,
      temperature: 0.2,
      max_completion_tokens: 500,
      messages: [{ role: "system", content: SYSTEM_INSTRUCTIONS }, { role: "user", content: message }],
    }),
  });
  if (!response.ok) throw new ProviderServiceError("Groq", response.status);
  const body = await response.json();
  const answer = body.choices?.[0]?.message?.content?.trim();
  if (!answer) throw new Error("AI 응답 내용이 비어 있습니다.");
  return answer;
}

function createHandler(options = {}) {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  const model = options.model ?? process.env.OPENAI_MODEL;
  const groqApiKey = options.groqApiKey ?? process.env.GROQ_API_KEY;
  const groqModel = options.groqModel ?? process.env.GROQ_MODEL ?? "openai/gpt-oss-20b";
  return async function handler(request, response) {
    try {
      if (request.method !== "POST") return send(response, 405, { error: "POST만 사용할 수 있습니다." });
      const payload = parseBody(request);
      const message = typeof payload.message === "string" ? payload.message.trim() : "";
      if (!message) return send(response, 400, { error: "질문을 입력해 주세요." });
      if (message.length > MAX_MESSAGE_LENGTH) return send(response, 400, { error: `질문은 ${MAX_MESSAGE_LENGTH}자 이내로 입력해 주세요.` });
      if (groqApiKey && typeof fetchImpl === "function") {
        const answer = await requestGroq(message, { fetch: fetchImpl, apiKey: groqApiKey, model: groqModel });
        return send(response, 200, { answer, mode: "Groq 무료 LLM", configured: true });
      }
      if (!apiKey || !model || typeof fetchImpl !== "function") return send(response, 200, { answer: fallbackAnswer(message), mode: "서버 안내 모드", configured: false });
      const answer = await requestOpenAI(message, { fetch: fetchImpl, apiKey, model });
      return send(response, 200, { answer, mode: "OpenAI Responses API", configured: true });
    } catch (error) {
      const status = error instanceof SyntaxError ? 400 : 502;
      if (status === 400) return send(response, status, { error: "요청 JSON 형식이 올바르지 않습니다." });
      if (error instanceof ProviderServiceError) {
        const messages = {
          400: "AI 모델 설정 또는 요청 형식을 확인해 주세요.",
          401: "AI 서비스 인증 정보를 다시 확인해 주세요.",
          403: "AI 서비스 키의 사용 권한을 확인해 주세요.",
          404: "설정한 AI 모델 이름을 확인해 주세요.",
          429: "AI 서비스의 무료 사용 한도에 도달했습니다. 잠시 후 다시 시도해 주세요.",
        };
        return send(response, status, {
          error: messages[error.providerStatus] ?? "AI 서비스 연결 상태를 확인해 주세요.",
          provider: error.provider,
          providerStatus: error.providerStatus,
        });
      }
      return send(response, status, { error: "AI 답변을 가져오지 못했습니다. 잠시 후 다시 시도해 주세요." });
    }
  };
}

const handler = createHandler();
module.exports = handler;
module.exports.createHandler = createHandler;
module.exports.extractOutput = extractOutput;
module.exports.fallbackAnswer = fallbackAnswer;
module.exports.requestGroq = requestGroq;
module.exports.ProviderServiceError = ProviderServiceError;

