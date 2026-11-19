@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
set "LANG=en_US.UTF-8"
set "FIREBASE_SKIP_UPDATE_CHECK=true"
set "NO_UPDATE_NOTIFIER=1"
set "XDG_CONFIG_HOME=%USERPROFILE%\.config"

if not exist "%USERPROFILE%\.config\configstore" mkdir "%USERPROFILE%\.config\configstore" >nul 2>&1

REM ============================================================
REM  _Cloud_run_KDT.bat  -  KDT-Inventory Clean Build + Cloud Deploy
REM
REM  Step 0 : Kill previous processes (port 3500 & KDT processes)
REM  Step 1 : Purge build/vite/functions caches
REM  Step 2 : Install dependencies (Root + Functions)
REM  Step 3 : Build frontend (Vite)
REM  Step 4 : Build Cloud Functions (tsc) + BUILD_STAMP
REM  Step 5 : Verify version in frontend bundle & functions lib
REM  Step 6 : Deploy Functions + Firestore (kdt-inventory)
REM  Step 7 : Deploy Hosting (kdt-inventory)
REM  Step 8 : Open production browser
REM ============================================================

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

echo.
echo ============================================================
echo  [START] KDT-Inventory Clean Build + Cloud Deploy
echo  %ROOT%
echo ============================================================
echo.

for /f tokens^=4^ delims^=^" %%a in ('findstr "\"version\"" "%ROOT%\Version.json"') do set APP_VER=%%a
echo ============================================================
echo   CURRENT BUILD VERSION : Ver!APP_VER!
echo ============================================================
echo.

REM ---- STEP 0 : KILL PREVIOUS PROCESSES ----------------------
echo [STEP 0] Killing previous processes (KyungHun Standard)...
powershell -NoProfile -Command "$ports=3500; $ids=@(); foreach($p in $ports){$ids+=(Get-NetTCPConnection -LocalPort $p -EA SilentlyContinue).OwningProcess}; $ids+=(Get-CimInstance Win32_Process | Where-Object{($_.Name -match 'node|firebase') -and $_.CommandLine -match 'KDT-Inventory' -and $_.ProcessId -ne $PID}).ProcessId; $ids | Where-Object{$_} | Select-Object -Unique | ForEach-Object{Stop-Process -Id $_ -Force -EA SilentlyContinue}"
echo [OK] Previous processes terminated.
echo.

REM ---- STEP 1 : PURGE BUILD/VITE CACHES ----------------------
echo [STEP 1] Purging build caches...
if exist "%ROOT%\dist"                   ( rmdir /s /q "%ROOT%\dist"                   & echo   [DEL] dist )
if exist "%ROOT%\node_modules\.vite"     ( rmdir /s /q "%ROOT%\node_modules\.vite"     & echo   [DEL] node_modules/.vite )
if exist "%ROOT%\node_modules\.cache"    ( rmdir /s /q "%ROOT%\node_modules\.cache"    & echo   [DEL] node_modules/.cache )
if exist "%ROOT%\.vite"                  ( rmdir /s /q "%ROOT%\.vite"                  & echo   [DEL] .vite )
if exist "%ROOT%\functions\lib"          ( rmdir /s /q "%ROOT%\functions\lib"           & echo   [DEL] functions/lib )
if exist "%ROOT%\functions\.tsbuildinfo" ( del   /f /q "%ROOT%\functions\.tsbuildinfo" & echo   [DEL] functions/.tsbuildinfo )
if exist "%TEMP%\vite-kdt-cache"         ( rmdir /s /q "%TEMP%\vite-kdt-cache"         & echo   [DEL] Temp/vite-kdt-cache )
echo [OK] Build caches purged.
echo.

REM ---- STEP 2 : INSTALL DEPENDENCIES -------------------------
echo [STEP 2] Checking dependencies...

set "ROOT_HASH=%ROOT%\node_modules\.pkg_hash.txt"
set "ROOT_INTEGRITY=%ROOT%\node_modules\remark-rehype\package.json"
if not exist "%ROOT%\node_modules"  goto :ROOT_INSTALL
if not exist "%ROOT_HASH%"          goto :ROOT_INSTALL
if not exist "%ROOT_INTEGRITY%" (
    echo   [WARN] remark-rehype missing. Force reinstall...
    rmdir /s /q "%ROOT%\node_modules"
    goto :ROOT_INSTALL
)
findstr /c:"remark-rehype" "%ROOT_INTEGRITY%" >nul 2>&1
if errorlevel 1 (
    echo   [WARN] remark-rehype corrupt. Force reinstall...
    rmdir /s /q "%ROOT%\node_modules"
    goto :ROOT_INSTALL
)
fc /b "%ROOT%\package.json" "%ROOT_HASH%" >nul 2>&1
if errorlevel 1                     goto :ROOT_INSTALL
echo   [SKIP] Root packages (integrity OK, no change).
goto :FUNC_CHECK

:ROOT_INSTALL
echo   [RUN] npm install (root)...
call npm install --no-audit --no-fund
if not exist "%ROOT%\node_modules\.bin\vite" (
    echo [ERROR] Root npm install failed - vite binary missing!
    goto :BUILD_FAIL
)
copy /y "%ROOT%\package.json" "%ROOT_HASH%" >nul 2>&1

:FUNC_CHECK
set "FUNC_HASH=%ROOT%\functions\node_modules\.pkg_hash.txt"
set "FUNC_KEY=%ROOT%\functions\node_modules\firebase-functions\package.json"
if not exist "%ROOT%\functions\node_modules"  goto :FUNC_INSTALL
if not exist "%FUNC_KEY%"                     goto :FUNC_INSTALL
if not exist "%FUNC_HASH%"                    goto :FUNC_INSTALL
fc /b "%ROOT%\functions\package.json" "%FUNC_HASH%" >nul 2>&1
if errorlevel 1                               goto :FUNC_INSTALL
echo   [SKIP] Functions packages (no change).
goto :DEPS_DONE

:FUNC_INSTALL
echo   [RUN] npm install (functions)...
pushd "%ROOT%\functions"
call npm install --no-audit --no-fund
popd
if errorlevel 1 ( echo [ERROR] Functions npm install failed! & goto :BUILD_FAIL )
if not exist "%FUNC_KEY%" ( echo [ERROR] firebase-functions missing after install! & goto :BUILD_FAIL )
copy /y "%ROOT%\functions\package.json" "%FUNC_HASH%" >nul 2>&1
echo   [OK] Functions packages ready.

:DEPS_DONE
echo [OK] Dependencies ready.
echo.

REM ---- STEP 3 : BUILD FRONTEND (Vite) ------------------------
echo [STEP 3] Building frontend...
call npm run build
if not exist "%ROOT%\dist\desktop\index.html" ( echo [ERROR] dist/desktop/index.html not created! & goto :BUILD_FAIL )
echo [OK] Frontend built.
echo.

REM ---- STEP 4 : BUILD CLOUD FUNCTIONS (tsc) ------------------
echo [STEP 4] Building Cloud Functions...
pushd "%ROOT%\functions"
call npm run build
popd
if not exist "%ROOT%\functions\lib\index.js" ( echo [ERROR] functions/lib/index.js not created! & goto :BUILD_FAIL )
set "BUILD_TS=%DATE:~0,4%%DATE:~5,2%%DATE:~8,2%_%TIME:~0,2%%TIME:~3,2%%TIME:~6,2%"
set "BUILD_TS=%BUILD_TS: =0%"
echo // BUILD_STAMP: Ver!APP_VER! !BUILD_TS! >> "%ROOT%\functions\lib\index.js"
echo [OK] Functions built and stamped [Ver!APP_VER! !BUILD_TS!]
echo.

REM ---- STEP 5 : VERIFY VERSION IN BUNDLE ---------------------
echo [STEP 5] Verifying version !APP_VER! in bundle...
findstr /r /m "!APP_VER!" "%ROOT%\dist\assets\*.js" >nul 2>&1
if errorlevel 1 ( echo [ERROR] Version !APP_VER! NOT found in frontend bundle! & goto :BUILD_FAIL )
findstr /m "BUILD_STAMP: Ver!APP_VER!" "%ROOT%\functions\lib\index.js" >nul 2>&1
if errorlevel 1 ( echo [ERROR] Timestamp NOT stamped in functions lib! & goto :BUILD_FAIL )
echo [OK] Ver!APP_VER! confirmed in BOTH frontend bundle AND functions lib.
echo.

REM ---- STEP 6 : DEPLOY FUNCTIONS + FIRESTORE -----------------
echo [STEP 6] Deploying Functions + Firestore (kdt-inventory)...
call :RUN_FIREBASE_DEPLOY "functions,firestore"
if errorlevel 1 (
    echo [WARN] Deploy failed - retrying once...
    call :RUN_FIREBASE_DEPLOY "functions,firestore"
    if errorlevel 1 goto :DEPLOY_FAIL
)
echo [OK] Functions + Firestore deployed.
echo.

REM ---- STEP 7 : DEPLOY HOSTING -------------------------------
echo [STEP 7] Deploying Hosting (kdt-inventory)...
call :RUN_FIREBASE_DEPLOY "hosting"
if errorlevel 1 goto :DEPLOY_FAIL
echo [OK] Hosting deployed.
echo.

REM ---- STEP 8 : OPEN BROWSER ---------------------------------
echo ============================================================
echo  [DONE] Build + Deploy Complete!  Ver!APP_VER!
echo  URL: https://kdt-inventory.web.app/login
echo ============================================================
echo.
start https://kdt-inventory.web.app/login
powershell -NoProfile -Command "Start-Sleep -s 5"
exit /b 0

:RUN_FIREBASE_DEPLOY
set "DEPLOY_ONLY=%~1"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$env:FIREBASE_SKIP_UPDATE_CHECK='true';" ^
  "$env:NO_UPDATE_NOTIFIER='1';" ^
  "$output = & firebase deploy --only '%DEPLOY_ONLY%' --project kdt-inventory --force 2>&1;" ^
  "$output | ForEach-Object { $_ };" ^
  "if ($LASTEXITCODE -eq 0 -or (($output | Out-String) -match 'Deploy complete!')) { exit 0 } else { exit 1 }"
exit /b %errorlevel%

:BUILD_FAIL
echo [FAIL] BUILD FAILED - deploy was NOT executed.
exit /b 1

:DEPLOY_FAIL
echo [FAIL] DEPLOY FAILED - build succeeded but deploy failed.
exit /b 1

endlocal
