@echo off
echo ========================================
echo       Yustream - OvenMediaEngine
echo ========================================
echo.

echo Verificando Docker...
docker --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Docker nao encontrado. Por favor, instale o Docker Desktop.
    echo Download: https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

echo Verificando Docker Compose...
docker compose --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERRO: Docker Compose nao encontrado.
    pause
    exit /b 1
)

echo.
echo Criando diretorios necessarios...
if not exist "ant-media-data" mkdir ant-media-data
if not exist "logs" mkdir logs
if not exist "ssl" mkdir ssl

echo.
echo Iniciando servicos...
docker compose up -d

echo.
echo Aguardando inicializacao dos servicos...
timeout /t 10 /nobreak >nul

echo.
echo ========================================
echo           Servicos Iniciados!
echo ========================================
echo.
echo Stream Player: http://localhost
echo OvenMediaEngine: Multiplas qualidades automaticas
echo.
echo Para OBS Studio:
echo   Servidor RTMP: rtmp://localhost:1935/live
echo   Chave Stream:  live (stream padrao unica)
echo.
echo Para VLC Player:
echo   URL HLS ABR:  http://localhost/ome-hls/live/live/abr.m3u8
echo   URL HLS 1080p: http://localhost/ome-hls/live/live/video_1080.m3u8
echo   URL HLS 720p:  http://localhost/ome-hls/live/live/video_720.m3u8
echo   URL RTMP: rtmp://localhost:1935/live/live
echo.
echo Stream Player Web: http://localhost
echo   - WebRTC (ultra baixa latencia)
echo   - LLHLS (baixa latencia)  
echo   - HLS (compativel)
echo   - Qualidades: Auto, 4K, 1440p, 1080p, 720p, 480p, 360p
echo.
echo Para parar os servicos, execute: docker compose down
echo Para ver logs, execute: docker compose logs
echo.
echo ========================================
pause
