@echo off
chcp 65001 >nul
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python을 찾을 수 없습니다. 배포_준비.md의 로컬 실행 방법을 확인하세요.
  pause
  exit /b 1
)
start "국회 요구자료 미리보기 서버" /min python -m http.server 8000 -d "%~dp0web"
timeout /t 2 /nobreak >nul
start "" "http://localhost:8000/assign.html"
echo 배분화면을 브라우저에서 열었습니다.
echo 서버를 끄려면 작업 관리자에서 python을 종료하세요.
timeout /t 3 /nobreak >nul
