@echo off
TITLE Meet-2 Classroom Platform Launcher
COLOR 0B

echo =======================================================
echo    MEET-2 CLASSROOM PLATFORM - ALL-IN-ONE STARTER
echo =======================================================
echo.

:: Check for Node.js
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed. Please install it from https://nodejs.org/
    pause
    exit /b
)

echo [STEP 0] Cleaning Ports (5000, 5173, 5174)...
for %%p in (5000, 5173, 5174) do (
    for /f "tokens=5" %%a in ('netstat -aon ^| findstr :%%p ^| findstr LISTENING') do (
        echo [INFO] Found process %%a on port %%p. Terminating...
        taskkill /f /pid %%a >nul 2>&1
    )
)
echo [SUCCESS] Ports are clean!
echo.


echo [1/4] Starting Cloudflare Sovereignty Tunnel...
echo      Mapping: api.60sec.shop, meet.60sec.shop, wall.60sec.shop
start "Meet-2: Secure Tunnel" cmd /k "cloudflared tunnel --config config.yml run classroom-server"

timeout /t 3 /nobreak >nul

echo [2/4] Starting Backend Server...
echo      Location: ./backend (Port 5000)
start "Meet-2: Backend" cmd /k "cd backend && npm run dev"

timeout /t 2 /nobreak >nul

echo [3/4] Starting Student Portal...
echo      Location: ./student-client (Port 5173)
start "Meet-2: Student Portal" cmd /k "cd student-client && npm run dev"

timeout /t 2 /nobreak >nul

echo [4/4] Starting Teacher Portal...
echo      Location: ./wall-client (Port 5174)
start "Meet-2: Teacher Portal" cmd /k "cd wall-client && npm run dev"

echo.
echo =======================================================
echo [SUCCESS] ALL SYSTEMS LIVE ON SOVEREIGN DOMAINS!
echo -------------------------------------------------------
echo  - Backend API: https://api.60sec.shop
echo  - Student:     https://meet.60sec.shop
echo  - Wall Dashboard: https://wall.60sec.shop
echo =======================================================
echo.
echo You can close this window. The others will keep running.
timeout /t 10
exit
