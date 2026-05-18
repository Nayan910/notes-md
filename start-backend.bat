@echo off
cd /d E:\oprncode\project\backend\notes-md-api
set JWT_SECRET=test
set CORS_ORIGINS=http://localhost:5173
echo Starting notes.md backend at http://localhost:8000 ...
python -m uvicorn main:app --host 0.0.0.0 --port 8000
echo.
pause
