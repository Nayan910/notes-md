@echo off
title notes.md - Starting servers...
cd /d "E:\oprncode\project"

echo ========================================
echo  Starting notes.md servers...
echo ========================================

:: Start backend
echo [1/2] Starting backend...
start "notes-md-backend" cmd /c "cd /d "E:\oprncode\project\backend\notes-md-api" && title notes.md-backend && echo Backend starting... && python -m uvicorn main:app --host 0.0.0.0 --port 8000"

:: Wait a moment
timeout /t 3 /nobreak >nul

:: Start frontend
echo [2/2] Starting frontend...
start "notes-md-frontend" cmd /c "cd /d "E:\oprncode\project\apps\notes-md" && title notes.md-frontend && echo Frontend starting... && npm run dev"

:: Wait for frontend to be ready
timeout /t 5 /nobreak >nul

:: Open browser
echo Opening browser...
start http://localhost:5173

echo.
echo ========================================
echo  Both servers starting!
echo  Frontend: http://localhost:5173
echo  Backend:  http://localhost:8000
echo.
echo  Close the server windows to stop.
echo ========================================
