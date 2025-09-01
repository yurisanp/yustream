@echo off
echo ========================================
echo      Yustream React - Modo Desenvolvimento
echo ========================================
echo.

cd yustream-react

echo Iniciando servidor de desenvolvimento React...
echo.
echo Interface disponivel em: http://localhost:3000
echo API Proxy: http://localhost:3000/WebRTCApp -> http://localhost:5080/WebRTCApp
echo.
echo Pressione Ctrl+C para parar o servidor
echo.

npm run dev
