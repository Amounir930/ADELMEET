@echo off
title Sovereign Classroom Launcher
color 0b

:menu
cls
echo ==========================================
echo    SOVEREIGN CLASSROOM - DESKTOP MODE
echo ==========================================
echo.
echo  [1] Launch Teacher Dashboard (Wall)
echo  [2] Launch Student Portal (Meet)
echo  [3] Exit
echo.
echo ==========================================
set /p choice="Enter your choice (1-3): "

if "%choice%"=="1" goto teacher
if "%choice%"=="2" goto student
if "%choice%"=="3" exit
goto menu

:teacher
echo.
echo Launching Teacher Dashboard...
start msedge --app=https://wall.60sec.shop
goto end

:student
echo.
echo Launching Student Portal...
start msedge --app=https://meet.60sec.shop
goto end

:end
echo.
echo Application Launched Successfully!
timeout /t 2 >nul
exit
