@echo off
echo Iniciando sistema YuStream com autenticacao...

echo.
echo ========================================
echo  YuStream - Sistema de Streaming
echo ========================================
echo.

echo [1/3] Parando containers existentes...
docker compose down

echo.
echo [2/3] Construindo e iniciando servicos...
docker compose up --build -d

echo.
echo [3/3] Aguardando servicos ficarem prontos...
timeout /t 10

echo.
echo ========================================
echo  Sistema iniciado com sucesso!
echo ========================================
echo.
echo Servicos disponiveis:
echo   - Interface Web: http://localhost
echo   - API Auth: http://localhost/api
echo   - OvenMediaEngine: rtmp://localhost:1935/live
echo.
echo Usuarios de teste:
echo   - admin / admin123 (administrador)
echo   - user / password (usuario comum)
echo.
echo Para parar o sistema: docker compose down
echo Para ver logs: docker compose logs -f
echo.

pause
