# Script de configuração automática de túnel SSH para YuStream VNC
# Windows Server 2025 - Configuração completa automatizada

param(
    [Parameter(Mandatory=$true)]
    [string]$ServerUrl,
    
    [Parameter(Mandatory=$true)]
    [string]$RegisterToken,
    
    [string]$MachineName = $env:COMPUTERNAME,
    [string]$ServerSSHUser = "yustream",
    [string]$ServerSSHPassword = "",
    [string]$VNCPassword = "YuStreamVNC123!",
    [int]$VNCPort = 5900,
    [switch]$InstallAsService = $true
)

Write-Host "=== Configuração Automática de Túnel SSH - YuStream VNC ===" -ForegroundColor Green

# Verificar privilégios de administrador
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-Error "Este script deve ser executado como Administrador!"
    exit 1
}

Write-Host "✅ Executando como Administrador" -ForegroundColor Green

# Extrair hostname do server URL
$serverHost = ([System.Uri]$ServerUrl).Host
Write-Host "🌐 Servidor detectado: $serverHost" -ForegroundColor Cyan

# 1. Instalar e configurar OpenSSH Server
Write-Host "`n1. Configurando OpenSSH Server..." -ForegroundColor Yellow

try {
    # Verificar se OpenSSH está instalado
    $sshFeature = Get-WindowsCapability -Online -Name OpenSSH.Server*
    if ($sshFeature.State -ne "Installed") {
        Write-Host "📦 Instalando OpenSSH Server..." -ForegroundColor Yellow
        Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0
    } else {
        Write-Host "✅ OpenSSH Server já está instalado" -ForegroundColor Green
    }

    # Configurar e iniciar serviço SSH
    Start-Service sshd -ErrorAction SilentlyContinue
    Set-Service -Name sshd -StartupType 'Automatic'

    # Configurar firewall para SSH
    New-NetFirewallRule -Name "YuStream-SSH" -DisplayName "YuStream SSH" -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22 -ErrorAction SilentlyContinue

    Write-Host "✅ OpenSSH Server configurado" -ForegroundColor Green
} catch {
    Write-Error "Erro ao configurar OpenSSH: $($_.Exception.Message)"
    exit 1
}

# 2. Criar usuário SSH dedicado
Write-Host "`n2. Configurando usuário SSH..." -ForegroundColor Yellow

try {
    $sshUserName = "yustream_ssh"
    $sshPassword = ConvertTo-SecureString "YuStreamSSH123!" -AsPlainText -Force
    
    # Verificar se usuário já existe
    $existingUser = Get-LocalUser -Name $sshUserName -ErrorAction SilentlyContinue
    if ($existingUser) {
        Write-Host "✅ Usuário SSH já existe: $sshUserName" -ForegroundColor Green
    } else {
        New-LocalUser -Name $sshUserName -Password $sshPassword -Description "YuStream SSH Tunnel User" -PasswordNeverExpires
        Write-Host "✅ Usuário SSH criado: $sshUserName" -ForegroundColor Green
    }

    # Adicionar ao grupo necessário
    Add-LocalGroupMember -Group "Remote Desktop Users" -Member $sshUserName -ErrorAction SilentlyContinue
    
    Write-Host "✅ Usuário SSH configurado" -ForegroundColor Green
} catch {
    Write-Warning "Aviso ao configurar usuário SSH: $($_.Exception.Message)"
}

# 3. Instalar e configurar TightVNC
Write-Host "`n3. Configurando TightVNC Server..." -ForegroundColor Yellow

try {
    # Verificar se TightVNC está instalado
    $tightVncPath = @(
        "${env:ProgramFiles}\TightVNC\tvnserver.exe",
        "${env:ProgramFiles(x86)}\TightVNC\tvnserver.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1

    if (-not $tightVncPath) {
        Write-Host "📦 Baixando e instalando TightVNC..." -ForegroundColor Yellow
        
        $vncUrl = "https://www.tightvnc.com/download/2.8.84/tightvnc-2.8.84-gpl-setup-64bit.msi"
        $vncInstaller = "$env:TEMP\tightvnc-installer.msi"
        
        Invoke-WebRequest -Uri $vncUrl -OutFile $vncInstaller
        
        # Instalar TightVNC silenciosamente
        $installArgs = @(
            "/i", $vncInstaller,
            "/quiet",
            "ADDLOCAL=Server",
            "SERVER_REGISTER_AS_SERVICE=1",
            "SERVER_ADD_FIREWALL_EXCEPTION=0",  # Não adicionar exceção geral
            "SET_USEVNCAUTHENTICATION=1",
            "VALUE_OF_USEVNCAUTHENTICATION=1",
            "SET_PASSWORD=1",
            "VALUE_OF_PASSWORD=$VNCPassword"
        )
        
        Start-Process -FilePath "msiexec.exe" -ArgumentList $installArgs -Wait
        Start-Sleep -Seconds 10
    }

    # Configurar TightVNC para localhost apenas
    $regPath = "HKLM:\SOFTWARE\TightVNC\Server"
    if (Test-Path $regPath) {
        Set-ItemProperty -Path $regPath -Name "AcceptRfbConnections" -Value 1
        Set-ItemProperty -Path $regPath -Name "RfbPort" -Value $VNCPort
        Set-ItemProperty -Path $regPath -Name "LocalhostOnly" -Value 1  # CRÍTICO: apenas localhost
        Set-ItemProperty -Path $regPath -Name "UseAuthentication" -Value 1
        
        Write-Host "✅ TightVNC configurado para localhost apenas" -ForegroundColor Green
    }

    # Reiniciar serviço TightVNC
    Restart-Service tvnserver -ErrorAction SilentlyContinue
    
    # Firewall: Bloquear VNC do exterior, permitir apenas localhost
    Remove-NetFirewallRule -DisplayName "*VNC*" -ErrorAction SilentlyContinue
    New-NetFirewallRule -DisplayName "VNC Block External" -Direction Inbound -Protocol TCP -LocalPort $VNCPort -Action Block -RemoteAddress "!127.0.0.1" -ErrorAction SilentlyContinue

    Write-Host "✅ TightVNC configurado e protegido" -ForegroundColor Green
} catch {
    Write-Error "Erro ao configurar TightVNC: $($_.Exception.Message)"
    exit 1
}

# 4. Instalar Python e dependências
Write-Host "`n4. Configurando Python..." -ForegroundColor Yellow

try {
    # Verificar Python
    $pythonVersion = python --version 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "📦 Instalando Python..." -ForegroundColor Yellow
        $pythonUrl = "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe"
        $pythonInstaller = "$env:TEMP\python-installer.exe"
        
        Invoke-WebRequest -Uri $pythonUrl -OutFile $pythonInstaller
        Start-Process -FilePath $pythonInstaller -ArgumentList "/quiet InstallAllUsers=1 PrependPath=1 Include_test=0" -Wait
        
        # Atualizar PATH
        $env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")
        Start-Sleep -Seconds 5
    }

    # Instalar dependências Python
    python -m pip install --upgrade pip
    python -m pip install requests paramiko

    Write-Host "✅ Python e dependências instaladas" -ForegroundColor Green
} catch {
    Write-Error "Erro ao configurar Python: $($_.Exception.Message)"
    exit 1
}

# 5. Criar configuração do cliente VNC
Write-Host "`n5. Criando configuração do cliente..." -ForegroundColor Yellow

$installDir = "$env:ProgramFiles\YuStreamVNCClient"
New-Item -ItemType Directory -Path $installDir -Force | Out-Null

# Detectar número de monitores
try {
    $monitors = Get-WmiObject -Class Win32_DesktopMonitor | Where-Object { $_.Status -eq "OK" }
    $monitorCount = $monitors.Count
    if ($monitorCount -eq 0) { $monitorCount = 1 }
} catch {
    $monitorCount = 1
}

# Criar configuração com túnel SSH reverso
$configData = @{
    server_url = $ServerUrl
    register_token = $RegisterToken
    machine_name = $MachineName
    vnc_port = $VNCPort
    monitors = $monitorCount
    ssh_enabled = $true
    ssh_port = 22
    ssh_username = "yustream_ssh"
    ssh_password = "YuStreamSSH123!"
    ssh_private_key_path = ""
    reverse_tunnel_enabled = $true
    server_ssh_host = $serverHost
    server_ssh_port = 22
    server_ssh_username = $ServerSSHUser
    server_ssh_password = $ServerSSHPassword
    heartbeat_interval = 30
    auto_start_vnc = $true
    vnc_password = $VNCPassword
    display = ":0"
}

$configPath = Join-Path $installDir "vnc-client.config.json"
$configData | ConvertTo-Json -Depth 10 | Out-File -FilePath $configPath -Encoding UTF8

Write-Host "✅ Configuração criada: $configPath" -ForegroundColor Green

# 6. Baixar e configurar cliente Python
Write-Host "`n6. Configurando cliente VNC..." -ForegroundColor Yellow

$clientPath = Join-Path $installDir "vnc-client.py"

# Copiar cliente se estiver no mesmo diretório
if (Test-Path ".\vnc-client.py") {
    Copy-Item ".\vnc-client.py" $clientPath
    Write-Host "✅ Cliente VNC copiado" -ForegroundColor Green
} else {
    Write-Host "⚠️ Baixando cliente do servidor..." -ForegroundColor Yellow
    try {
        Invoke-WebRequest -Uri "$ServerUrl/vnc-client.py" -OutFile $clientPath
        Write-Host "✅ Cliente VNC baixado" -ForegroundColor Green
    } catch {
        Write-Error "Erro ao baixar cliente VNC. Copie manualmente vnc-client.py para $installDir"
        exit 1
    }
}

# 7. Criar scripts de gerenciamento
Write-Host "`n7. Criando scripts de gerenciamento..." -ForegroundColor Yellow

# Script de inicialização
$startScriptPath = Join-Path $installDir "start-vnc-tunnel.bat"
$startScriptContent = @(
    "@echo off",
    "echo Iniciando YuStream VNC com Tunel SSH...",
    "cd /d `"$installDir`"",
    "python vnc-client.py",
    "pause"
) -join "`r`n"
$startScriptContent | Out-File -FilePath $startScriptPath -Encoding ASCII

# Script de configuração
$configScriptPath = Join-Path $installDir "configure-vnc.bat"
$configScriptContent = @(
    "@echo off",
    "echo Configurando YuStream VNC...",
    "cd /d `"$installDir`"",
    "python vnc-client.py --setup",
    "pause"
) -join "`r`n"
$configScriptContent | Out-File -FilePath $configScriptPath -Encoding ASCII

# Script de teste
$testScriptPath = Join-Path $installDir "test-vnc-connection.bat"
$testScriptContent = @(
    "@echo off",
    "echo Testando conexao VNC local...",
    "telnet localhost $VNCPort",
    "pause"
) -join "`r`n"
$testScriptContent | Out-File -FilePath $testScriptPath -Encoding ASCII

Write-Host "✅ Scripts criados" -ForegroundColor Green

# 8. Instalar como serviço Windows
if ($InstallAsService) {
    Write-Host "`n8. Instalando como serviço Windows..." -ForegroundColor Yellow
    
    try {
        $serviceName = "YuStreamVNCTunnel"
        $serviceDisplayName = "YuStream VNC Tunnel"
        $serviceDescription = "Cliente VNC com túnel SSH automático para YuStream"
        
        # Remover serviço existente
        $existingService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
        if ($existingService) {
            Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
            & sc.exe delete $serviceName
            Start-Sleep -Seconds 3
        }
        
        # Criar novo serviço
        $pythonExe = (Get-Command python).Source
        $serviceCommand = "`"$pythonExe`" `"$clientPath`""
        
        & sc.exe create $serviceName binPath= $serviceCommand DisplayName= $serviceDisplayName start= auto
        & sc.exe description $serviceName $serviceDescription
        & sc.exe config $serviceName obj= "NT AUTHORITY\LocalService"
        
        Write-Host "✅ Serviço Windows criado: $serviceName" -ForegroundColor Green
    } catch {
        Write-Warning "Não foi possível instalar como serviço: $($_.Exception.Message)"
    }
}

# 9. Criar atalhos no desktop
Write-Host "`n9. Criando atalhos..." -ForegroundColor Yellow

$shell = New-Object -ComObject WScript.Shell

# Atalho para iniciar
$shortcutPath1 = Join-Path "$env:PUBLIC\Desktop" "YuStream VNC Tunnel.lnk"
$shortcut1 = $shell.CreateShortcut($shortcutPath1)
$shortcut1.TargetPath = $startScriptPath
$shortcut1.WorkingDirectory = $installDir
$shortcut1.Description = "Iniciar YuStream VNC com Túnel SSH"
$shortcut1.Save()

# Atalho para configurar
$shortcutPath2 = Join-Path "$env:PUBLIC\Desktop" "Configurar YuStream VNC.lnk"
$shortcut2 = $shell.CreateShortcut($shortcutPath2)
$shortcut2.TargetPath = $configScriptPath
$shortcut2.WorkingDirectory = $installDir
$shortcut2.Description = "Configurar YuStream VNC"
$shortcut2.Save()

Write-Host "✅ Atalhos criados no desktop" -ForegroundColor Green

# 10. Teste de conectividade
Write-Host "`n10. Testando configuração..." -ForegroundColor Yellow

# Testar VNC local
try {
    $vncTest = Test-NetConnection -ComputerName "localhost" -Port $VNCPort -WarningAction SilentlyContinue
    if ($vncTest.TcpTestSucceeded) {
        Write-Host "✅ TightVNC respondendo na porta $VNCPort" -ForegroundColor Green
    } else {
        Write-Warning "TightVNC não está respondendo na porta $VNCPort"
    }
} catch {
    Write-Warning "Não foi possível testar porta VNC"
}

# Testar SSH local
try {
    $sshTest = Test-NetConnection -ComputerName "localhost" -Port 22 -WarningAction SilentlyContinue
    if ($sshTest.TcpTestSucceeded) {
        Write-Host "✅ SSH Server respondendo na porta 22" -ForegroundColor Green
    } else {
        Write-Warning "SSH Server não está respondendo na porta 22"
    }
} catch {
    Write-Warning "Não foi possível testar porta SSH"
}

# Informações finais
Write-Host "`n" + "="*60 -ForegroundColor Cyan
Write-Host "CONFIGURAÇÃO AUTOMÁTICA CONCLUÍDA" -ForegroundColor Green
Write-Host "="*60 -ForegroundColor Cyan

Write-Host "`n📋 Resumo da configuração:" -ForegroundColor Yellow
Write-Host "• Servidor YuStream: $ServerUrl" -ForegroundColor Gray
Write-Host "• Máquina: $MachineName" -ForegroundColor Gray
Write-Host "• VNC Port: $VNCPort (localhost apenas)" -ForegroundColor Gray
Write-Host "• SSH Port: 22" -ForegroundColor Gray
Write-Host "• SSH User: yustream_ssh" -ForegroundColor Gray
Write-Host "• Monitores: $monitorCount" -ForegroundColor Gray
Write-Host "• Túnel SSH: Habilitado (reverso)" -ForegroundColor Gray

Write-Host "`n🚀 Para iniciar:" -ForegroundColor Yellow
Write-Host "1. Execute: YuStream VNC Tunnel (atalho no desktop)" -ForegroundColor Gray
if ($InstallAsService) {
    Write-Host "2. Ou inicie o serviço: Start-Service -Name YuStreamVNCTunnel" -ForegroundColor Gray
}

Write-Host "`n🔧 Para configurar:" -ForegroundColor Yellow
Write-Host "1. Execute: Configurar YuStream VNC (atalho no desktop)" -ForegroundColor Gray
Write-Host "2. Ou edite: $configPath" -ForegroundColor Gray

Write-Host "`n🔒 Segurança:" -ForegroundColor Yellow
Write-Host "• VNC bloqueado do exterior (apenas localhost)" -ForegroundColor Gray
Write-Host "• SSH com usuário dedicado" -ForegroundColor Gray
Write-Host "• Túnel SSH criptografado" -ForegroundColor Gray
Write-Host "• Autenticação obrigatória" -ForegroundColor Gray

Write-Host "`n📖 Documentação:" -ForegroundColor Cyan
Write-Host "• CONFIGURACAO_SSH_TUNEL_REVERSO.md" -ForegroundColor Gray
Write-Host "• WINDOWS_SERVER_2025_SETUP.md" -ForegroundColor Gray

# Perguntar se quer iniciar agora
$response = Read-Host "`nDeseja iniciar o cliente VNC agora? (s/N)"
if ($response -eq "s" -or $response -eq "S") {
    if ($InstallAsService) {
        Write-Host "Iniciando serviço..." -ForegroundColor Yellow
        Start-Service -Name "YuStreamVNCTunnel" -ErrorAction SilentlyContinue
    } else {
        Write-Host "Iniciando cliente..." -ForegroundColor Yellow
        Start-Process -FilePath $startScriptPath
    }
}

Write-Host "`n🎉 Configuração automática finalizada!" -ForegroundColor Green
Write-Host "O sistema está pronto para controle VNC total via túnel SSH seguro." -ForegroundColor Green
