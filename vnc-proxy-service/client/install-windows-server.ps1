# Script de instalação do Cliente VNC YuStream para Windows Server 2025
# Execute como Administrador

param(
    [string]$ServerUrl = "https://your-yustream-server.com",
    [string]$RegisterToken = "yustream-vnc-register-token-change-in-production",
    [string]$MachineName = $env:COMPUTERNAME,
    [int]$VncPort = 5900,
    [string]$VncPassword = "",
    [switch]$AutoStart = $false,
    [switch]$InstallAsService = $true
)

Write-Host "=== Instalação do Cliente VNC YuStream para Windows Server 2025 ===" -ForegroundColor Green

# Verificar se está executando como administrador
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Error "Este script deve ser executado como Administrador!"
    Write-Host "Clique com o botão direito no PowerShell e selecione 'Executar como administrador'" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Executando como Administrador" -ForegroundColor Green

# Verificar versão do Windows
$osVersion = Get-WmiObject -Class Win32_OperatingSystem
Write-Host "Sistema: $($osVersion.Caption) - $($osVersion.Version)" -ForegroundColor Cyan

# Verificar se Python está instalado
try {
    $pythonVersion = python --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Python encontrado: $pythonVersion" -ForegroundColor Green
    } else {
        throw "Python não encontrado"
    }
} catch {
    Write-Host "❌ Python não encontrado. Instalando Python..." -ForegroundColor Red
    
    # Baixar e instalar Python
    $pythonUrl = "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe"
    $pythonInstaller = "$env:TEMP\python-installer.exe"
    
    Write-Host "📥 Baixando Python..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri $pythonUrl -OutFile $pythonInstaller
    
    Write-Host "📦 Instalando Python..." -ForegroundColor Yellow
    Start-Process -FilePath $pythonInstaller -ArgumentList "/quiet InstallAllUsers=1 PrependPath=1 Include_test=0" -Wait
    
    # Atualizar PATH
    $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
    
    # Verificar instalação
    Start-Sleep -Seconds 5
    try {
        $pythonVersion = python --version 2>&1
        Write-Host "✅ Python instalado: $pythonVersion" -ForegroundColor Green
    } catch {
        Write-Error "Falha na instalação do Python. Instale manualmente."
        exit 1
    }
}

# Instalar dependências Python
Write-Host "📦 Instalando dependências Python..." -ForegroundColor Yellow
try {
    python -m pip install --upgrade pip
    python -m pip install requests pywin32
    Write-Host "✅ Dependências instaladas" -ForegroundColor Green
} catch {
    Write-Error "Falha ao instalar dependências Python"
    exit 1
}

# Detectar número de monitores
Write-Host "🖥️ Detectando monitores..." -ForegroundColor Yellow
try {
    $monitors = Get-WmiObject -Class Win32_DesktopMonitor | Where-Object { $_.Status -eq "OK" }
    $monitorCount = $monitors.Count
    if ($monitorCount -eq 0) { $monitorCount = 1 }
    Write-Host "✅ Detectados $monitorCount monitor(s)" -ForegroundColor Green
} catch {
    $monitorCount = 1
    Write-Host "⚠️ Não foi possível detectar monitores, assumindo 1" -ForegroundColor Yellow
}

# Configurar TightVNC Server
Write-Host "🖥️ Configurando servidor VNC..." -ForegroundColor Yellow

# Verificar se TightVNC está instalado
$tightVncPath = @(
    "${env:ProgramFiles}\TightVNC\tvnserver.exe",
    "${env:ProgramFiles(x86)}\TightVNC\tvnserver.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $tightVncPath) {
    Write-Host "❌ TightVNC não encontrado. Instalando..." -ForegroundColor Red
    
    # Baixar TightVNC
    $vncUrl = "https://www.tightvnc.com/download/2.8.84/tightvnc-2.8.84-gpl-setup-64bit.msi"
    $vncInstaller = "$env:TEMP\tightvnc-installer.msi"
    
    Write-Host "📥 Baixando TightVNC..." -ForegroundColor Yellow
    Invoke-WebRequest -Uri $vncUrl -OutFile $vncInstaller
    
    # Instalar TightVNC silenciosamente
    Write-Host "📦 Instalando TightVNC..." -ForegroundColor Yellow
    $installArgs = @(
        "/i", $vncInstaller,
        "/quiet",
        "ADDLOCAL=Server",
        "SERVER_REGISTER_AS_SERVICE=1",
        "SERVER_ADD_FIREWALL_EXCEPTION=1",
        "VIEWER_ASSOCIATE_VNC_EXTENSION=1"
    )
    
    if ($VncPassword) {
        $installArgs += "SET_USEVNCAUTHENTICATION=1"
        $installArgs += "VALUE_OF_USEVNCAUTHENTICATION=1"
        $installArgs += "SET_PASSWORD=1"
        $installArgs += "VALUE_OF_PASSWORD=$VncPassword"
    }
    
    Start-Process -FilePath "msiexec.exe" -ArgumentList $installArgs -Wait
    
    # Verificar instalação
    Start-Sleep -Seconds 10
    $tightVncPath = @(
        "${env:ProgramFiles}\TightVNC\tvnserver.exe",
        "${env:ProgramFiles(x86)}\TightVNC\tvnserver.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1
    
    if ($tightVncPath) {
        Write-Host "✅ TightVNC instalado: $tightVncPath" -ForegroundColor Green
    } else {
        Write-Error "Falha na instalação do TightVNC"
        exit 1
    }
} else {
    Write-Host "✅ TightVNC encontrado: $tightVncPath" -ForegroundColor Green
}

# Configurar firewall para VNC
Write-Host "🔥 Configurando firewall..." -ForegroundColor Yellow
try {
    # Regra para servidor VNC
    New-NetFirewallRule -DisplayName "YuStream VNC Server" -Direction Inbound -Protocol TCP -LocalPort $VncPort -Action Allow -ErrorAction SilentlyContinue
    
    # Regra para HTTP Admin (TightVNC)
    New-NetFirewallRule -DisplayName "YuStream VNC HTTP" -Direction Inbound -Protocol TCP -LocalPort 5800 -Action Allow -ErrorAction SilentlyContinue
    
    Write-Host "✅ Regras de firewall configuradas" -ForegroundColor Green
} catch {
    Write-Warning "Não foi possível configurar firewall automaticamente"
}

# Criar diretório de instalação
$installDir = "$env:ProgramFiles\YuStreamVNCClient"
New-Item -ItemType Directory -Path $installDir -Force | Out-Null
Write-Host "📁 Diretório de instalação: $installDir" -ForegroundColor Cyan

# Criar arquivo de configuração
$configData = @{
    server_url = $ServerUrl
    register_token = $RegisterToken
    machine_name = $MachineName
    vnc_port = $VncPort
    monitors = $monitorCount
    ssh_enabled = $false
    ssh_port = 22
    ssh_username = ""
    ssh_password = ""
    ssh_private_key_path = ""
    heartbeat_interval = 30
    auto_start_vnc = $true
    vnc_password = $VncPassword
    display = ":0"
}

$configPath = Join-Path $installDir "vnc-client.config.json"
$configData | ConvertTo-Json -Depth 10 | Out-File -FilePath $configPath -Encoding UTF8
Write-Host "✅ Arquivo de configuração criado: $configPath" -ForegroundColor Green

# Baixar cliente Python (se não estiver presente)
$clientPath = Join-Path $installDir "vnc-client.py"
if (Test-Path ".\vnc-client.py") {
    Copy-Item ".\vnc-client.py" $clientPath
    Write-Host "✅ Cliente VNC copiado" -ForegroundColor Green
} else {
    Write-Host "⚠️ vnc-client.py não encontrado no diretório atual" -ForegroundColor Yellow
    Write-Host "   Baixe manualmente de: $ServerUrl/vnc-client.py" -ForegroundColor Yellow
}

# Criar script de inicialização
$startScriptPath = Join-Path $installDir "start-vnc-client.bat"
$startScriptContent = @(
    "@echo off",
    "cd /d `"$installDir`"",
    "python vnc-client.py",
    "pause"
) -join "`r`n"
$startScriptContent | Out-File -FilePath $startScriptPath -Encoding ASCII

# Criar script de configuração
$configScriptPath = Join-Path $installDir "configure-vnc-client.bat"
$configScriptContent = @(
    "@echo off",
    "cd /d `"$installDir`"",
    "python vnc-client.py --setup",
    "pause"
) -join "`r`n"
$configScriptContent | Out-File -FilePath $configScriptPath -Encoding ASCII

# Criar script PowerShell para serviço
$serviceScriptPath = Join-Path $installDir "vnc-client-service.ps1"
$serviceScriptContent = @(
    "# Script de serviço VNC Client",
    "`$installDir = `"$installDir`"",
    "Set-Location `$installDir",
    "python vnc-client.py"
) -join "`r`n"
$serviceScriptContent | Out-File -FilePath $serviceScriptPath -Encoding UTF8

# Instalar como serviço Windows se solicitado
if ($InstallAsService) {
    Write-Host "🔧 Instalando como serviço Windows..." -ForegroundColor Yellow
    
    try {
        # Usar NSSM (Non-Sucking Service Manager) se disponível, senão usar sc.exe
        $serviceName = "YuStreamVNCClient"
        $serviceDisplayName = "YuStream VNC Client"
        $serviceDescription = "Cliente VNC para acesso remoto YuStream"
        
        # Remover serviço existente se houver
        $existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
        if ($existingService) {
            Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
            & sc.exe delete $serviceName
            Start-Sleep -Seconds 2
        }
        
        # Criar serviço usando sc.exe
        $pythonExe = (Get-Command python).Source
        $serviceCommand = "`"$pythonExe`" `"$clientPath`""
        
        & sc.exe create $serviceName binPath= $serviceCommand DisplayName= $serviceDisplayName start= auto
        & sc.exe description $serviceName $serviceDescription
        & sc.exe config $serviceName obj= "NT AUTHORITY\LocalService"
        
        Write-Host "✅ Serviço Windows criado: $serviceName" -ForegroundColor Green
        Write-Host "   Para iniciar: Start-Service -Name $serviceName" -ForegroundColor Cyan
        Write-Host "   Para parar: Stop-Service -Name $serviceName" -ForegroundColor Cyan
        
    } catch {
        Write-Warning "Não foi possível instalar como serviço: $($_.Exception.Message)"
    }
}

# Configurar inicialização automática
if ($AutoStart) {
    Write-Host "🚀 Configurando inicialização automática..." -ForegroundColor Yellow
    
    $startupPath = Join-Path "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup" "YuStreamVNC.bat"
    $startupScriptContent = @(
        "@echo off",
        "cd /d `"$installDir`"",
        "python vnc-client.py"
    ) -join "`r`n"
    
    $startupScriptContent | Out-File -FilePath $startupPath -Encoding ASCII
    Write-Host "✅ Inicialização automática configurada" -ForegroundColor Green
}

# Criar atalhos no desktop
Write-Host "🔗 Criando atalhos..." -ForegroundColor Yellow

$shell = New-Object -ComObject WScript.Shell

# Atalho para iniciar cliente
$shortcutPath1 = Join-Path "$env:PUBLIC\Desktop" "YuStream VNC Client.lnk"
$shortcut1 = $shell.CreateShortcut($shortcutPath1)
$shortcut1.TargetPath = Join-Path $installDir "start-vnc-client.bat"
$shortcut1.WorkingDirectory = $installDir
$shortcut1.Description = "Iniciar Cliente VNC YuStream"
$shortcut1.Save()

# Atalho para configuração
$shortcutPath2 = Join-Path "$env:PUBLIC\Desktop" "Configurar YuStream VNC.lnk"
$shortcut2 = $shell.CreateShortcut($shortcutPath2)
$shortcut2.TargetPath = Join-Path $installDir "configure-vnc-client.bat"
$shortcut2.WorkingDirectory = $installDir
$shortcut2.Description = "Configurar Cliente VNC YuStream"
$shortcut2.Save()

Write-Host "✅ Atalhos criados no desktop" -ForegroundColor Green

# Informações finais
Write-Host ""
Write-Host "🎉 Instalação concluída com sucesso!" -ForegroundColor Green
Write-Host ""
Write-Host "📁 Arquivos instalados em: $installDir" -ForegroundColor Cyan
Write-Host "📄 Configuração: $configPath" -ForegroundColor Cyan
Write-Host ""
Write-Host "📋 Próximos passos:" -ForegroundColor Yellow
Write-Host "1. Configure o cliente (se necessário): Executar 'Configurar YuStream VNC' no desktop"
Write-Host "2. Inicie o cliente: Executar 'YuStream VNC Client' no desktop"
if ($InstallAsService) {
    Write-Host "3. Ou inicie o serviço: Start-Service -Name YuStreamVNCClient"
}
Write-Host ""
Write-Host "🔧 Configurações importantes:" -ForegroundColor Yellow
Write-Host "• Servidor VNC: TightVNC na porta $VncPort"
Write-Host "• Monitores detectados: $monitorCount"
Write-Host "• Firewall: Configurado para porta $VncPort"
if ($VncPassword) {
    Write-Host "• Senha VNC: Configurada"
} else {
    Write-Host "• Senha VNC: Não configurada (recomendado definir uma)"
}
Write-Host ""
Write-Host "📖 Para mais informações:" -ForegroundColor Cyan
Write-Host "   Consulte VNC_REMOTE_ACCESS_DOCUMENTATION.md"
Write-Host ""

# Perguntar se quer iniciar agora
$response = Read-Host "Deseja iniciar o cliente VNC agora? (s/N)"
if ($response -eq "s" -or $response -eq "S") {
    if ($InstallAsService) {
        Write-Host "Iniciando serviço..." -ForegroundColor Yellow
        Start-Service -Name "YuStreamVNCClient" -ErrorAction SilentlyContinue
    } else {
        Write-Host "Iniciando cliente..." -ForegroundColor Yellow
        Start-Process -FilePath (Join-Path $installDir "start-vnc-client.bat")
    }
}

Write-Host "✅ Instalação finalizada!" -ForegroundColor Green

