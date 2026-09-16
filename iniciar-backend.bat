@echo off
title LeadBoard - Backend
cd /d "%~dp0backend"

echo.
echo  LeadBoard - Backend
echo  ===================
echo.

rem O uv instalado via pip fica em %APPDATA%\Python\PythonXXX\Scripts, que nao
rem costuma estar no PATH. Procura no PATH primeiro e cai no caminho conhecido.
set "UV="
where uv >nul 2>&1 && set "UV=uv"
if not defined UV (
    for /d %%D in ("%APPDATA%\Python\Python*") do (
        if exist "%%D\Scripts\uv.exe" set "UV=%%D\Scripts\uv.exe"
    )
)
if not defined UV (
    if exist "%LOCALAPPDATA%\Programs\uv\uv.exe" set "UV=%LOCALAPPDATA%\Programs\uv\uv.exe"
)
if not defined UV (
    echo  [ERRO] uv nao encontrado.
    echo         Instale com:  python -m pip install uv
    echo.
    pause
    exit /b 1
)

rem Sincroniza sempre: e rapido quando ja esta em dia e evita o erro de
rem dependencia faltando depois de um git pull.
echo  Sincronizando dependencias...
"%UV%" sync --quiet
if errorlevel 1 (
    echo.
    echo  [ERRO] Falha ao sincronizar as dependencias.
    echo.
    pause
    exit /b 1
)

if not exist "%~dp0data" mkdir "%~dp0data"
set "LEADBOARD_DATA_ROOT=%~dp0data"

echo.
echo  API      http://localhost:8000/api/dispatch
echo  Health   http://localhost:8000/api/health
echo  Docs     http://localhost:8000/api/docs
echo.
echo  Modo usuario unico: sem login, toda request vale como "local".
echo  Ctrl+C para parar.
echo.

"%UV%" run uvicorn core_gateway.bootstrap:build_app --factory --reload --port 8000

echo.
echo  Servidor encerrado.
pause
