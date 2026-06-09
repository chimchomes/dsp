@echo off
cd /d "c:\Users\chiom\OneDrive\AIProjects\DSP_app\DSPDEV"

netstat -ano | findstr ":8082" | findstr "LISTENING" >nul
if %errorlevel%==0 (
    echo Dev server is already running on http://localhost:8082/
    pause
    exit /b 0
)

echo Starting dev server on http://localhost:8082/
pnpm dev
pause