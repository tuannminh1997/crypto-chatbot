@echo off
REM =========================================
REM Build + Copy Frontend to Backend Script
REM =========================================

REM Always switch to the folder where build.cmd is located
cd /d "%~dp0"

echo -------------------------------------
echo Building frontend (React Vite)
echo -------------------------------------

cd frontend

REM Install dependencies if node_modules not exist
if not exist node_modules (
    echo Installing node_modules...
    call npm install
)

REM Build production
call npm run build

cd ..

REM Clean old build in backend
echo Cleaning old build in backend...
if exist backend\frontend\build rmdir /s /q backend\frontend\build

REM Create build folder again
mkdir backend\frontend\build

REM Copy new dist into backend build folder
xcopy frontend\dist\* backend\frontend\build\ /E /I /Y

echo -------------------------------------
echo Build and Copy Completed Successfully
echo -------------------------------------
pause
