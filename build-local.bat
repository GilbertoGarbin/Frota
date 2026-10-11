@echo off
echo.
echo ========================================
echo  Build local do Frota.apk
echo ========================================
echo.

set EXPO_ROUTER_APP_ROOT=src/app
set ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk
set NODE_ENV=production

cd /d d:\Projetos\Frota

echo Feche outros programas pesados antes de continuar: o build usa quase toda a memoria.
echo.
echo [1/5] Parando processos Java/Gradle/Android Studio...
taskkill /F /IM studio64.exe /T >nul 2>&1
taskkill /F /IM studio.exe /T >nul 2>&1
taskkill /F /IM java.exe /T >nul 2>&1
taskkill /F /IM gradle.exe /T >nul 2>&1
echo    Aguardando liberacao de arquivos...
timeout /t 5 /nobreak >nul

echo [2/5] Removendo pasta android anterior...
if exist "android" (
    powershell -Command "Remove-Item -Recurse -Force 'android' -ErrorAction SilentlyContinue"
    timeout /t 2 /nobreak >nul
)
if exist "android" (
    echo.
    echo ERRO: Nao foi possivel remover a pasta android.
    echo Feche o Android Studio e tente novamente.
    pause
    exit /b 1
)

echo [3/5] Gerando projeto Android (prebuild)...
call npx expo prebuild --platform android
if %errorlevel% neq 0 (
    echo ERRO no prebuild!
    pause
    exit /b 1
)

echo.
echo [4/5] Compilando APK (pode levar de 10 a 20 minutos)...
cd android
rem Mais memoria para o build e sem a etapa de lint: com os limites padrao o Gradle
rem estoura a memoria nesta maquina (8 GB de RAM).
call gradlew.bat --stop >nul 2>&1
call gradlew.bat assembleRelease -x lintVitalAnalyzeRelease -x lintVitalReportRelease -x lintVitalRelease --max-workers=2 "-Dorg.gradle.jvmargs=-Xmx2560m -XX:MaxMetaspaceSize=1024m" -Pkotlin.compiler.execution.strategy=in-process
if %errorlevel% neq 0 (
    echo ERRO na compilacao!
    pause
    exit /b 1
)
cd ..

echo.
echo [5/5] Copiando APK...
if not exist "APP" mkdir APP
copy /Y "android\app\build\outputs\apk\release\app-release.apk" "APP\Frota.apk"
if %errorlevel% neq 0 (
    echo ERRO ao copiar o APK!
    pause
    exit /b 1
)

echo.
echo ========================================
echo  Frota.apk gerado em APP\Frota.apk
echo ========================================
echo.
echo Para publicar no GitHub:
echo   1. A pagina "Nova release" vai abrir no navegador.
echo   2. Em "Choose a tag", digite uma versao (ex.: v1.0.0) e clique em "Create new tag".
echo   3. Arraste o arquivo Frota.apk (a pasta APP tambem vai abrir) para a area de anexos.
echo   4. Clique em "Publish release".
echo   O link para os amigos baixarem fica em:
echo   https://github.com/GilbertoGarbin/Frota/releases/latest/download/Frota.apk
echo.
start "" explorer "d:\Projetos\Frota\APP"
start "" "https://github.com/GilbertoGarbin/Frota/releases/new"
pause
