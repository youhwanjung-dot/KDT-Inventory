@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion
set "LANG=en_US.UTF-8"
set "LC_ALL=en_US.UTF-8"

REM ============================================================
REM  _Local_run_KDT.bat  -  KDT-Inventory Local Clean Build + Run
REM
REM  Step 0 : Kill previous processes (port 3500 & KDT processes)
REM  Step 1 : Purge ALL caches (Triple Cache Wipe)
REM  Step 2 : Check / Install dependencies (hash check)
REM  Step 3 : Clean Build (Vite)
REM  Step 4 : Verify version string in bundle
REM  Step 5 : Start hidden local preview server (port 3500) + Open browser
REM ============================================================

set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"

echo.
echo ============================================================
echo  [START] KDT-Inventory Local Clean Build + Run
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

REM ---- STEP 1 : PURGE ALL CACHES -----------------------------
echo [STEP 1] Purging ALL caches (Triple Cache Wipe)...
if exist "%ROOT%\dist"                ( rmdir /s /q "%ROOT%\dist"                & echo   [DEL] dist )
if exist "%ROOT%\node_modules\.vite"  ( rmdir /s /q "%ROOT%\node_modules\.vite"  & echo   [DEL] node_modules/.vite )
if exist "%ROOT%\node_modules\.cache" ( rmdir /s /q "%ROOT%\node_modules\.cache" & echo   [DEL] node_modules/.cache )
if exist "%ROOT%\.vite"               ( rmdir /s /q "%ROOT%\.vite"               & echo   [DEL] .vite )
if exist "%TEMP%\vite-kdt-cache"      ( rmdir /s /q "%TEMP%\vite-kdt-cache"      & echo   [DEL] Temp/vite-kdt-cache )
echo [OK] All caches purged.
echo.

REM ---- STEP 2 : INSTALL DEPENDENCIES -------------------------
echo [STEP 2] Checking dependencies (KyungHun Standard)...
set "ROOT_PKG_HASH=%ROOT%\node_modules\.pkg_hash.txt"
set "ROOT_INTEGRITY=%ROOT%\node_modules\remark-rehype\package.json"
if not exist "%ROOT%\node_modules" goto ROOT_NPM_INSTALL
if not exist "%ROOT_PKG_HASH%"     goto ROOT_NPM_INSTALL
if not exist "%ROOT_INTEGRITY%"    goto ROOT_NPM_INSTALL
fc /b "%ROOT%\package.json" "%ROOT_PKG_HASH%" >nul 2>&1
if errorlevel 1                    goto ROOT_NPM_INSTALL
echo   [SKIP] Root npm install (package.json unchanged).
goto DEPS_DONE

:ROOT_NPM_INSTALL
echo   [SETUP] Installing root packages...
pushd "%ROOT%"
call npm install --no-audit --no-fund
popd
if not exist "%ROOT%\node_modules\.bin\vite" goto BUILD_FAIL
copy /y "%ROOT%\package.json" "%ROOT_PKG_HASH%" >nul 2>&1

:DEPS_DONE
echo [OK] Dependencies ready.
echo.

REM ---- STEP 3 : CLEAN BUILD (Vite) ---------------------------
echo [STEP 3] Building frontend (clean build)...
pushd "%ROOT%"
call npm run build
popd
if not exist "%ROOT%\dist\desktop\index.html" ( echo [ERROR] dist/desktop/index.html was NOT created! & goto BUILD_FAIL )
echo [OK] Frontend built successfully.
echo.

REM ---- STEP 4 : VERSION VERIFY IN BUNDLE ---------------------
echo [STEP 4] Verifying version string in bundle...
findstr /r /m "!APP_VER!" "%ROOT%\dist\assets\*.js" >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Version !APP_VER! NOT found in bundle - build may be stale!
    goto BUILD_FAIL
)
echo [OK] Version !APP_VER! confirmed in bundle.
echo.

REM ---- STEP 5 : START LOCAL PREVIEW SERVER (HIDDEN) ----------
echo [STEP 5] Starting local preview server (port 3500, hidden)...
powershell -NoProfile -Command "Start-Process -FilePath 'cmd.exe' -ArgumentList '/c npx vite preview --host --port 3500 --strictPort' -WorkingDirectory '%ROOT%' -WindowStyle Hidden"

echo [INFO] Waiting for server to initialize (5 seconds)...
powershell -NoProfile -Command "Start-Sleep -s 5"

start http://localhost:3500/desktop/

echo.
echo ============================================================
echo  [DONE] Local build and launch complete!  Ver!APP_VER!
echo  URL: http://localhost:3500/desktop/
echo ============================================================
exit /b 0

:BUILD_FAIL
echo ============================================================
echo  [FAIL] BUILD FAILED - server was NOT started.
echo ============================================================
exit /b 1

endlocal
