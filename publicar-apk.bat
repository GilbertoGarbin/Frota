@echo off
setlocal EnableDelayedExpansion
rem ==========================================================================
rem  Compila o APK do Frota na nuvem do Expo (EAS) e publica no GitHub.
rem  Link fixo para baixar no celular (sempre a versao mais nova):
rem    https://github.com/GilbertoGarbin/Frota/releases/latest/download/Frota.apk
rem ==========================================================================

cd /d d:\Projetos\Frota
set REPO=GilbertoGarbin/Frota
set APK=APP\Frota.apk
set JSON=%TEMP%\frota-build.json

echo.
echo ========================================
echo  Publicar o app Android do Frota
echo ========================================
echo.

rem --- GitHub CLI (gh) -------------------------------------------------------
set GH=gh
where gh >nul 2>&1
if errorlevel 1 (
    if exist "%ProgramFiles%\GitHub CLI\gh.exe" (
        set GH="%ProgramFiles%\GitHub CLI\gh.exe"
    ) else (
        echo Instalando o GitHub CLI...
        winget install --id GitHub.cli -e --silent --accept-source-agreements --accept-package-agreements
        set GH="%ProgramFiles%\GitHub CLI\gh.exe"
    )
)

%GH% auth status >nul 2>&1
if errorlevel 1 (
    echo.
    echo Primeira vez: e preciso entrar na sua conta do GitHub.
    echo Vai aparecer um codigo aqui e o navegador vai abrir: cole o codigo e autorize.
    echo.
    %GH% auth login --hostname github.com --git-protocol https --web
    if errorlevel 1 (
        echo ERRO: nao foi possivel entrar no GitHub.
        pause
        exit /b 1
    )
)

rem --- O que fazer ------------------------------------------------------------
echo  1 = Compilar um APK novo e publicar   (leva uns 15 a 20 minutos)
echo  2 = Publicar o ultimo APK ja compilado no Expo (rapido)
echo.
set /p OPCAO=Escolha 1 ou 2 e aperte Enter:

if "%OPCAO%"=="2" goto ultimo

echo.
echo [1/3] Compilando na nuvem do Expo... (pode fechar a tampa do cafe, demora)
call eas build -p android --profile preview --non-interactive --wait --json > "%JSON%"
if errorlevel 1 (
    echo ERRO na compilacao. Veja os detalhes em https://expo.dev/accounts/gilberto.garbin/projects/frota/builds
    pause
    exit /b 1
)
goto baixar

:ultimo
echo.
echo [1/3] Procurando o ultimo APK compilado...
call eas build:list -p android --status finished --build-profile preview --limit 1 --json --non-interactive > "%JSON%"
if errorlevel 1 (
    echo ERRO ao consultar o Expo.
    pause
    exit /b 1
)

:baixar
echo [2/3] Baixando o APK...
if not exist "APP" mkdir APP
powershell -NoProfile -Command "$b = Get-Content -Raw '%JSON%' | ConvertFrom-Json; $u = @($b)[0].artifacts.buildUrl; if (-not $u) { exit 1 }; Invoke-WebRequest -Uri $u -OutFile '%APK%'"
if errorlevel 1 (
    echo ERRO: nao achei o APK para baixar.
    pause
    exit /b 1
)

echo [3/3] Publicando no GitHub...
for /f %%t in ('powershell -NoProfile -Command "Get-Date -Format yyyy.MM.dd-HHmm"') do set TAG=v%%t
%GH% release create %TAG% "%APK%" --repo %REPO% --title "Frota %TAG%" --notes "App Android do Frota (motorista). Baixe o arquivo Frota.apk no celular e instale." --latest
if errorlevel 1 (
    echo ERRO ao publicar no GitHub.
    pause
    exit /b 1
)

echo.
echo ========================================
echo  Pronto! Versao %TAG% publicada.
echo ========================================
echo.
echo  No celular, abra este link para baixar e instalar:
echo  https://github.com/%REPO%/releases/latest/download/Frota.apk
echo.
echo  (o link e sempre o mesmo: baixa sempre a versao mais nova)
echo.
pause
