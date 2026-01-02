@echo off
echo Starting Backend...
start "Backend" cmd /k ".\venv_new\Scripts\python.exe server.py"
echo Starting Frontend...
start "Frontend" cmd /k ".\venv_new\Scripts\python.exe -m http.server 3000 --directory frontend"
echo Application is running.
echo Frontend: http://localhost:3000
echo Backend: http://localhost:8000
echo Press any key to exit this launcher (servers will remain running)...
pause
