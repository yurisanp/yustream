@echo off
echo ========================================
echo       Yustream React - Build Producao
echo ========================================
echo.

cd yustream-react

echo Fazendo build da aplicacao React...
call npm run build

if %errorlevel% equ 0 (
    echo.
    echo Build concluido com sucesso!
    echo.
    echo Copiando arquivos para pasta web...
    cd ..
    
    if exist web (
        rmdir /s /q web
    )
    
    xcopy /E /I yustream-react\dist web
    
    echo.
    echo Reiniciando Nginx...
    docker-compose restart nginx
    
    echo.
    echo ========================================
    echo        Build e Deploy Concluidos!
    echo ========================================
    echo.
    echo Stream Player disponivel em: http://localhost
    echo Stream ID padrao: live
    echo Auto-play ativado
    echo Interface otimizada para smartphones e TVs
    echo.
) else (
    echo.
    echo ERRO: Falha no build da aplicacao React
    echo Verifique os erros acima.
)

pause
