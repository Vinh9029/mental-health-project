@echo off
title MindCare AI Launcher

echo Starting MindCare AI...

:: =========================
:: FRONTEND
:: =========================
@REM echo Installing frontend dependencies...
@REM call npm install

echo Starting frontend on port 8080...
start "Frontend" cmd /k "npm run dev"

:: =========================
:: BACKEND
:: =========================
echo Starting backend on port 8000...
start cmd /k "cd backend && call venv\Scripts\activate && python -m uvicorn main:app --reload --port 8000"
@REM start cmd /k "cd backend && if not exist venv python -m venv venv && call venv\Scripts\activate && pip install -r requirements.txt && python -m uvicorn main:app --reload --port 8000"
echo.
echo Both servers are launching...
pause 
exit