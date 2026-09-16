@echo off
title LeadBoard - Frontend
cd /d "%~dp0frontend"

echo.
echo  LeadBoard - Frontend
echo  ====================
echo.

where npm >nul 2>&1
if errorlevel 1 (
    echo  [ERRO] npm nao encontrado. Instale o Node.js: https://nodejs.org
    echo.
    pause
    exit /b 1
)

rem Instala so quando falta, para nao pagar o custo do npm install a cada clique.
if not exist "node_modules" (
    echo  Instalando dependencias, pode demorar na primeira vez...
    call npm install
    if errorlevel 1 (
        echo.
        echo  [ERRO] Falha ao instalar as dependencias.
        echo.
        pause
        exit /b 1
    )
    echo.
)

echo  App      http://localhost:5173
echo.
echo  O proxy de /api aponta para http://localhost:8000 - rode o
echo  iniciar-backend.bat antes, ou as chamadas vao falhar.
echo.
echo  Ctrl+C para parar.
echo.

call npm run dev

echo.
echo  Servidor encerrado.
pause
