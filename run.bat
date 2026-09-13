@echo off
echo ===================================================
echo             Starting SentriX System
echo ===================================================
echo.

:: Check if server binary exists or run with go
if exist "%~dp0dist\sentrix-server.exe" (
    start "SentriX Server (:8080)" cmd /k "cd /d "%~dp0server" && "%~dp0dist\sentrix-server.exe""
) else (
    start "SentriX Server (:8080)" cmd /k "cd /d "%~dp0server" && go run ./cmd/sentrix-server"
)

:: Start Vite dev server for frontend
start "SentriX Web Dashboard (:3000)" cmd /k "cd /d "%~dp0web" && npm run dev"

echo.
echo ===================================================
echo SentriX Server:      http://localhost:8080
echo SentriX Web UI:      http://localhost:3000
echo Default Credentials: admin@sentrix.local / admin12345
echo ===================================================
echo.
timeout /t 3 /nobreak >nul 2>&1 || ping -n 4 127.0.0.1 >nul
start http://localhost:3000
