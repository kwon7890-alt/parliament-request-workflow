# 재외동포청 국회의정지원 업무관리

국회 요구자료를 **접수 → 소관부서 배분 → 현업 회신 → 취합·검토 → 처리기록 확인** 순서로 관리하는 기능시험용 웹앱입니다. 규칙과 검색 결과가 우선이며, AI는 담당부서 확정이나 답변 결재를 대신하지 않습니다.

## 바로 열기

- 메인: `https://parliament-request-workflow.vercel.app/web/index.html`
- 접수·배분: `https://parliament-request-workflow.vercel.app/web/assign.html`
- 현업 회신: `https://parliament-request-workflow.vercel.app/web/dept.html`
- 취합·검토: `https://parliament-request-workflow.vercel.app/web/collect.html`
- AI 안내: `https://parliament-request-workflow.vercel.app/web/chat.html`
- API: `https://parliament-request-workflow.vercel.app/api/app`
- GitHub: `https://github.com/kwon7890-alt/parliament-request-workflow`

## 업무 흐름

1. PDF·접수대장을 읽어 요구 문항을 등록합니다.
2. 규칙 점수와 근거 키워드로 소관부서 후보를 제시합니다.
3. 총괄 담당자가 주관·협조부서를 확인해 배분합니다.
4. 현업부서가 회신 파일과 검토 상태를 등록합니다.
5. 총괄 담당자가 누락·합계·기한을 검토하고 결과를 내려받습니다.
6. 모든 변경은 처리기록에 남겨 다음 요청에서 다시 확인합니다.

## 중요한 사용 원칙

- 현재 공개 주소는 **가상자료용 기능시험**입니다. 실자료·개인정보·비공개 문서를 입력하지 않습니다.
- 답변 작성, 결재, 최종 판단, 국회 제출은 사람이 수행합니다.
- AI 기능은 사용자가 명시적으로 질문할 때만 호출하며, 기관 원문을 자동 전송하지 않습니다.
- 실운영 전에는 로그인·권한관리 또는 Vercel 접근 보호를 먼저 적용해야 합니다.

## 시험

```text
npm run test:api
npm run test:chat
npm run test:bridge
npm run test:s5
npm run test:ui
```

`test:ui`는 메인·접수·현업·취합·AI 안내 5개 화면을 PC와 모바일에서 검사합니다. 기관명, 공개시험 경고, 화면 표시, 가로 넘침, 자바스크립트 오류를 확인하고 검증 이미지를 `검증결과/업무형UI`에 저장합니다.
