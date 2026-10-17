@echo off
cd /d "%~dp0"
if not exist .env (
  copy .env.example .env >nul
  echo Se creo el archivo .env
)
echo Verificando dependencias...
call npm install
call npm run dev
pause
