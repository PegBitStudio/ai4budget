@echo off
set PATH=C:\Program Files\nodejs;%PATH%
cd /d "c:\DriveSync\Creative\AI_FOR_EVERYDAY_LIFE"

echo.
echo ============================================
echo    AI4Budget - Setup and Run
echo ============================================
echo.

echo [1/3] Checking Node.js...
node --version
if errorlevel 1 (
    echo ERROR: Node.js not found. Install from https://nodejs.org
    pause
    exit /b 1
)

echo.
echo [2/3] Installing dependencies (this may take a minute)...
call npm install
if errorlevel 1 (
    echo ERROR: npm install failed
    pause
    exit /b 1
)

echo.
echo [3/3] Starting dev server...
echo.
echo ============================================
echo    App running at http://localhost:3000
echo    Press Ctrl+C to stop
echo ============================================
echo.
call npm run dev
