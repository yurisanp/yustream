@echo off
setlocal

echo === Instalacao do Cliente VNC YuStream ===

:: Verificar se Python esta instalado
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python nao encontrado. Por favor, instale Python 3.7 ou superior.
    echo    Download: https://www.python.org/downloads/
    pause
    exit /b 1
)

echo ✅ Python encontrado

:: Verificar se pip esta disponivel
pip --version >nul 2>&1
if errorlevel 1 (
    echo ❌ pip nao encontrado. Reinstale o Python com pip.
    pause
    exit /b 1
)

echo ✅ pip disponivel

:: Instalar dependencias Python
echo 📦 Instalando dependencias Python...
pip install requests

:: Criar diretorio de instalacao
set INSTALL_DIR=%USERPROFILE%\yustream-vnc-client
if not exist "%INSTALL_DIR%" mkdir "%INSTALL_DIR%"

:: Criar arquivo de configuracao se nao existir
if not exist "%INSTALL_DIR%\vnc-client.config.json" (
    echo 📄 Criando arquivo de configuracao...
    (
        echo {
        echo   "server_url": "https://your-yustream-server.com",
        echo   "register_token": "yustream-vnc-register-token-change-in-production",
        echo   "machine_name": "%COMPUTERNAME%",
        echo   "vnc_port": 5900,
        echo   "monitors": 1,
        echo   "ssh_enabled": false,
        echo   "ssh_port": 22,
        echo   "ssh_username": "",
        echo   "ssh_password": "",
        echo   "ssh_private_key_path": "",
        echo   "heartbeat_interval": 30,
        echo   "auto_start_vnc": false,
        echo   "vnc_password": "",
        echo   "display": ":0"
        echo }
    ) > "%INSTALL_DIR%\vnc-client.config.json"
)

:: Copiar script principal se estiver no mesmo diretorio
if exist "vnc-client.py" (
    copy "vnc-client.py" "%INSTALL_DIR%\" >nul
    echo ✅ Cliente VNC copiado para %INSTALL_DIR%
) else (
    echo ⚠️ vnc-client.py nao encontrado no diretorio atual
    echo    Baixe manualmente de: https://your-yustream-server.com/vnc-client.py
)

:: Criar script de inicializacao
(
    echo @echo off
    echo cd /d "%INSTALL_DIR%"
    echo python vnc-client.py %%*
    echo pause
) > "%INSTALL_DIR%\start.bat"

:: Criar script de configuracao
(
    echo @echo off
    echo cd /d "%INSTALL_DIR%"
    echo python vnc-client.py --setup
    echo pause
) > "%INSTALL_DIR%\configure.bat"

:: Informacoes sobre VNC no Windows
echo.
echo 🖥️ Configuracao VNC para Windows:
echo.
echo Para usar VNC no Windows, voce precisa instalar um servidor VNC:
echo.
echo 1. TightVNC: https://www.tightvnc.com/download.php
echo 2. UltraVNC: https://www.uvnc.com/downloads/ultravnc.html
echo 3. RealVNC: https://www.realvnc.com/pt/connect/download/vnc/
echo.
echo Apos instalar, configure a senha e inicie o servico.
echo.

echo.
echo 🎉 Instalacao concluida!
echo.
echo 📁 Arquivos instalados em: %INSTALL_DIR%
echo.
echo 📋 Proximos passos:
echo 1. Instale um servidor VNC (TightVNC recomendado)
echo 2. Configure o cliente: %INSTALL_DIR%\configure.bat
echo 3. Inicie o cliente: %INSTALL_DIR%\start.bat
echo.
echo 📖 Para mais informacoes, consulte a documentacao:
echo    VNC_REMOTE_ACCESS_DOCUMENTATION.md
echo.

:: Perguntar se quer executar configuracao agora
set /p REPLY="Deseja executar a configuracao agora? (s/N): "
if /i "%REPLY%"=="s" (
    cd /d "%INSTALL_DIR%"
    python vnc-client.py --setup
)

echo ✅ Instalacao finalizada!
pause
