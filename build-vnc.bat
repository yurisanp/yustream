@echo off
echo === Build do Sistema VNC YuStream ===

echo.
echo 1. Instalando dependencias do frontend...
cd yustream-react
call npm install
if errorlevel 1 (
    echo ❌ Erro ao instalar dependencias do frontend
    pause
    exit /b 1
)

echo.
echo 2. Construindo frontend...
call npm run build
if errorlevel 1 (
    echo ❌ Erro ao construir frontend
    pause
    exit /b 1
)

cd ..

echo.
echo 3. Instalando dependencias do VNC proxy...
cd vnc-proxy-service
call npm install
if errorlevel 1 (
    echo ❌ Erro ao instalar dependencias do VNC proxy
    pause
    exit /b 1
)

cd ..

echo.
echo 4. Construindo containers Docker...
docker-compose build vnc-proxy
if errorlevel 1 (
    echo ❌ Erro ao construir container VNC proxy
    pause
    exit /b 1
)

docker-compose build nginx
if errorlevel 1 (
    echo ❌ Erro ao construir container nginx
    pause
    exit /b 1
)

echo.
echo ✅ Build concluido com sucesso!
echo.
echo Para iniciar os servicos:
echo   docker-compose up -d
echo.
echo Para acessar o painel VNC:
echo   1. Faca login como admin
echo   2. Va para /admin
echo   3. Clique na aba "VNC Remoto"
echo.
echo Para configurar uma maquina remota:
echo   1. Execute: vnc-proxy-service/client/install.bat
echo   2. Configure: python vnc-client.py --setup
echo   3. Inicie: python vnc-client.py
echo.
pause
