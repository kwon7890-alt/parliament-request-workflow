# Vercel 제출판

이 저장소 전체가 Vercel에 배포되는 기준본입니다. 첫 화면에는 `2028년 정보화예산 편성` 숫자판이 표시됩니다.

## 배포 방법

### Vercel 웹 화면

1. 이 저장소를 GitHub에 올립니다.
2. Vercel에서 **Add New → Project**를 선택합니다.
3. 저장소를 선택하고 Framework Preset은 **Other**로 둡니다.
4. Root Directory는 저장소 최상위 폴더로 둡니다.
5. Build Command는 비우고 Output Directory는 `public`으로 둡니다.
6. Deploy를 누릅니다.

기존 국회요구자료 주소(`/web/assign.html` 등)는 새 숫자판 첫 화면(`/`)으로 이동합니다.

### 명령 실행

Node.js와 인터넷 연결이 있는 PC에서 `VERCEL_배포.cmd`를 실행합니다. 최초 한 번은 Vercel 로그인이 필요합니다.

## 저장 범위

- 입력값은 방문한 브라우저의 localStorage에만 저장됩니다.
- 다른 PC·브라우저·사용자에게 자동 공유되지 않습니다.
- Vercel 서버 파일에는 저장하지 않습니다.
- 기관 원문과 개인정보는 이 공개판에 올리지 않습니다.

## 폐쇄망판과 차이

- 공개판: 정적 화면, 규칙 계산, 브라우저 저장
- 폐쇄망판: Python 서버, JSON 변경이력, SQLite 승인·감사, Ollama Gemma 4
- RTX PRO 6000과 Ollama는 기관 내부 PC에서 실행하며 Vercel이 직접 접근하지 않습니다.

## 공식 근거

- Vercel 정적 사이트는 빌드 없이 `public` 같은 출력 폴더를 배포할 수 있습니다: https://vercel.com/docs/builds
- Vercel Function 파일시스템은 읽기 전용이고 `/tmp`만 임시 쓰기가 가능합니다: https://vercel.com/docs/functions/runtimes
- 지속 파일 저장에는 Vercel Blob 같은 외부 저장소가 필요합니다: https://vercel.com/kb/guide/how-can-i-use-files-in-serverless-functions

