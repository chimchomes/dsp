@echo off
setlocal enabledelayedexpansion
set KILLED=0

echo Looking for dev server on port 8082...

for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8082" ^| findstr "LISTENING"') do (
    echo Stopping PID %%a...
    taskkill /PID %%a /F
    set KILLED=1
)

if !KILLED!==0 (
    echo No dev server found on port 8082.
) else (
    echo Dev server stopped.
)

pause