# YuStream VNC - Guia para Windows Server 2025

## 📋 Visão Geral

Este guia fornece instruções específicas para configurar uma máquina Windows Server 2025 como cliente VNC remoto para o sistema YuStream.

## 🔧 Pré-requisitos

### Sistema Operacional
- Windows Server 2025 (Standard ou Datacenter)
- Privilégios de Administrador
- Acesso à Internet

### Software Necessário
- Python 3.11+ (será instalado automaticamente)
- TightVNC Server (será instalado automaticamente)
- PowerShell 5.1+ (incluído no Windows Server 2025)

## 🚀 Instalação Automática (Recomendado)

### Método 1: Script PowerShell Completo

1. **Baixar e executar script de instalação:**

```powershell
# Executar como Administrador
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force

# Baixar script
Invoke-WebRequest -Uri "https://your-yustream-server.com/install-windows-server.ps1" -OutFile "install-vnc.ps1"

# Executar instalação
.\install-vnc.ps1 -ServerUrl "https://your-yustream-server.com" -RegisterToken "your-token" -InstallAsService

.\install-windows-server.ps1 -ServerUrl "http://localhost" -RegisterToken "yustream-vnc-register-token-change-in-production" -InstallAsService
```

2. **Parâmetros do script:**

```powershell
.\install-vnc.ps1 `
    -ServerUrl "https://your-yustream-server.com" `
    -RegisterToken "your-register-token" `
    -MachineName "STREAMING-SERVER-01" `
    -VncPort 5900 `
    -VncPassword "secure-vnc-password" `
    -AutoStart `
    -InstallAsService
```

### Método 2: Instalação Manual

Se preferir instalar manualmente, siga os passos abaixo.

## 🔨 Instalação Manual

### 1. Preparar o Sistema

```powershell
# Habilitar execução de scripts
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser -Force

# Criar diretório de trabalho
New-Item -ItemType Directory -Path "C:\YuStreamVNC" -Force
Set-Location "C:\YuStreamVNC"
```

### 2. Instalar Python

```powershell
# Baixar Python 3.11
$pythonUrl = "https://www.python.org/ftp/python/3.11.9/python-3.11.9-amd64.exe"
Invoke-WebRequest -Uri $pythonUrl -OutFile "python-installer.exe"

# Instalar Python silenciosamente
.\python-installer.exe /quiet InstallAllUsers=1 PrependPath=1 Include_test=0

# Atualizar PATH na sessão atual
$env:PATH = [System.Environment]::GetEnvironmentVariable("PATH", "Machine") + ";" + [System.Environment]::GetEnvironmentVariable("PATH", "User")

# Verificar instalação
python --version
pip --version
```

### 3. Instalar Dependências Python

```powershell
# Instalar dependências
python -m pip install --upgrade pip
python -m pip install requests pywin32
```

### 4. Instalar TightVNC Server

```powershell
# Baixar TightVNC
$vncUrl = "https://www.tightvnc.com/download/2.8.84/tightvnc-2.8.84-gpl-setup-64bit.msi"
Invoke-WebRequest -Uri $vncUrl -OutFile "tightvnc-installer.msi"

# Instalar TightVNC
msiexec /i tightvnc-installer.msi /quiet ADDLOCAL=Server SERVER_REGISTER_AS_SERVICE=1 SERVER_ADD_FIREWALL_EXCEPTION=1 SET_USEVNCAUTHENTICATION=1 VALUE_OF_USEVNCAUTHENTICATION=1 SET_PASSWORD=1 VALUE_OF_PASSWORD=your-vnc-password
```

### 5. Configurar Firewall

```powershell
# Regras de firewall para VNC
New-NetFirewallRule -DisplayName "YuStream VNC Server" -Direction Inbound -Protocol TCP -LocalPort 5900 -Action Allow
New-NetFirewallRule -DisplayName "YuStream VNC HTTP" -Direction Inbound -Protocol TCP -LocalPort 5800 -Action Allow

# Verificar regras
Get-NetFirewallRule -DisplayName "YuStream VNC*"
```

### 6. Baixar Cliente VNC

```powershell
# Baixar cliente Python
Invoke-WebRequest -Uri "https://your-yustream-server.com/vnc-client-windows-server.py" -OutFile "vnc-client.py"

# Ou usar a versão genérica
Invoke-WebRequest -Uri "https://your-yustream-server.com/vnc-client.py" -OutFile "vnc-client.py"
```

### 7. Configurar Cliente

```powershell
# Executar configuração inicial
python vnc-client.py --setup
```

Preencha as informações solicitadas:
- **URL do servidor**: `https://your-yustream-server.com`
- **Token de registro**: `your-register-token`
- **Nome da máquina**: `STREAMING-SERVER-01`
- **Porta VNC**: `5900`
- **Senha VNC**: `your-secure-password`

## 🔧 Configuração como Serviço Windows

### Instalar Serviço

```powershell
# Instalar como serviço Windows
python vnc-client.py --install-service

# Configurar serviço para inicialização automática
Set-Service -Name "YuStreamVNCClient" -StartupType Automatic

# Iniciar serviço
Start-Service -Name "YuStreamVNCClient"
```

### Gerenciar Serviço

```powershell
# Status do serviço
Get-Service -Name "YuStreamVNCClient"

# Iniciar serviço
Start-Service -Name "YuStreamVNCClient"

# Parar serviço
Stop-Service -Name "YuStreamVNCClient"

# Reiniciar serviço
Restart-Service -Name "YuStreamVNCClient"

# Remover serviço
python vnc-client.py --remove-service
```

### Logs do Serviço

```powershell
# Logs do Windows Event Log
Get-WinEvent -FilterHashtable @{LogName='Application'; ProviderName='YuStreamVNCClient'}

# Logs do arquivo
Get-Content -Path "C:\YuStreamVNC\vnc-client.log" -Tail 50 -Wait
```

## 🖥️ Configurações Específicas do Windows Server

### 1. Configuração de Múltiplos Monitores

```powershell
# Verificar monitores conectados
Get-WmiObject -Class Win32_DesktopMonitor | Where-Object {$_.Status -eq "OK"}

# Configurar resolução (exemplo para 2 monitores)
# Monitor 1: 1920x1080
# Monitor 2: 1920x1080
```

### 2. Configuração de Sessões RDP Simultâneas

Se você precisar de acesso RDP e VNC simultâneos:

```powershell
# Habilitar múltiplas sessões RDP (requer licenciamento adequado)
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Terminal Server" -Name "fDenyTSConnections" -Value 0

# Configurar política de sessão
Set-ItemProperty -Path "HKLM:\SOFTWARE\Policies\Microsoft\Windows NT\Terminal Services" -Name "MaxInstanceCount" -Value 2
```

### 3. Otimizações de Performance

```powershell
# Desabilitar efeitos visuais para melhor performance VNC
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects" -Name "VisualFXSetting" -Value 2

# Configurar energia para alta performance
powercfg /setactive SCHEME_MIN

# Desabilitar hibernação
powercfg /hibernate off
```

## 🔒 Configurações de Segurança

### 1. Configuração de Senha VNC

```powershell
# Configurar senha via registry (TightVNC)
$regPath = "HKLM:\SOFTWARE\TightVNC\Server"
New-Item -Path $regPath -Force
Set-ItemProperty -Path $regPath -Name "UseAuthentication" -Value 1
# Senha será configurada pelo cliente Python
```

### 2. Restrições de Rede

```powershell
# Permitir VNC apenas de IPs específicos
New-NetFirewallRule -DisplayName "YuStream VNC Restricted" -Direction Inbound -Protocol TCP -LocalPort 5900 -Action Allow -RemoteAddress "192.168.1.0/24"

# Remover regra geral se necessário
Remove-NetFirewallRule -DisplayName "YuStream VNC Server"
```

### 3. Configuração de Usuário de Serviço

```powershell
# Criar usuário específico para serviço VNC
$password = ConvertTo-SecureString "ComplexPassword123!" -AsPlainText -Force
New-LocalUser -Name "YuStreamVNC" -Password $password -Description "YuStream VNC Service Account"

# Adicionar direitos necessários
Add-LocalGroupMember -Group "Log on as a service" -Member "YuStreamVNC"
```

## 📊 Monitoramento e Troubleshooting

### 1. Verificar Status do Sistema

```powershell
# Status dos serviços
Get-Service -Name "*vnc*", "*tight*", "YuStreamVNCClient"

# Portas em uso
Get-NetTCPConnection -LocalPort 5900, 5800

# Processos VNC
Get-Process -Name "*vnc*", "*tight*" -ErrorAction SilentlyContinue
```

### 2. Logs e Diagnósticos

```powershell
# Logs do cliente VNC
Get-Content -Path "C:\YuStreamVNC\vnc-client.log" -Tail 20

# Logs do TightVNC
Get-Content -Path "C:\Program Files\TightVNC\tvnserver.log" -Tail 20

# Event Viewer - Application logs
Get-WinEvent -FilterHashtable @{LogName='Application'; Level=2,3} | Where-Object {$_.ProviderName -like "*VNC*"} | Select-Object -First 10
```

### 3. Testes de Conectividade

```powershell
# Testar conexão com servidor YuStream
Test-NetConnection -ComputerName "your-yustream-server.com" -Port 443

# Testar porta VNC local
Test-NetConnection -ComputerName "localhost" -Port 5900

# Testar registro com servidor
Invoke-RestMethod -Uri "https://your-yustream-server.com/api/vnc/register" -Method POST -ContentType "application/json" -Body '{"test": true}'
```

## 🔧 Configurações Avançadas

### 1. Configuração de Proxy (se necessário)

```powershell
# Configurar proxy para Python requests
$env:HTTP_PROXY = "http://proxy.company.com:8080"
$env:HTTPS_PROXY = "http://proxy.company.com:8080"

# Configurar proxy no arquivo de configuração
# Editar vnc-client.config.json e adicionar:
# "proxy": {
#   "http": "http://proxy.company.com:8080",
#   "https": "http://proxy.company.com:8080"
# }
```

### 2. Configuração de SSL/TLS Personalizado

```powershell
# Para certificados auto-assinados, configurar no Python
# Editar vnc-client.py e adicionar:
# import ssl
# ssl._create_default_https_context = ssl._create_unverified_context
```

### 3. Configuração de Backup Automático

```powershell
# Script de backup da configuração
$backupScript = @"
# Backup VNC Configuration
$date = Get-Date -Format "yyyy-MM-dd"
$backupPath = "C:\Backups\VNC\$date"
New-Item -ItemType Directory -Path $backupPath -Force
Copy-Item "C:\YuStreamVNC\vnc-client.config.json" $backupPath
Copy-Item "C:\YuStreamVNC\vnc-client.log" $backupPath
"@

$backupScript | Out-File -FilePath "C:\YuStreamVNC\backup.ps1"

# Agendar backup diário
$action = New-ScheduledTaskAction -Execute "PowerShell.exe" -Argument "-File C:\YuStreamVNC\backup.ps1"
$trigger = New-ScheduledTaskTrigger -Daily -At "02:00"
Register-ScheduledTask -TaskName "YuStream VNC Backup" -Action $action -Trigger $trigger
```

## 🆘 Problemas Comuns e Soluções

### 1. Serviço não inicia

```powershell
# Verificar logs
Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='Service Control Manager'} | Where-Object {$_.Message -like "*YuStream*"}

# Verificar dependências
Get-Service -Name "YuStreamVNCClient" -RequiredServices

# Reiniciar dependências
Restart-Service -Name "Themes", "Desktop Window Manager Session Manager"
```

### 2. Conexão VNC falha

```powershell
# Verificar TightVNC
Get-Service -Name "tvnserver"
Restart-Service -Name "tvnserver"

# Testar conexão local
telnet localhost 5900

# Verificar firewall
Get-NetFirewallRule -DisplayName "*VNC*" | Get-NetFirewallPortFilter
```

### 3. Performance lenta

```powershell
# Verificar uso de CPU/Memória
Get-Process -Name "*vnc*" | Select-Object Name, CPU, WorkingSet

# Otimizar configurações de vídeo
# Reduzir resolução ou qualidade de cor se necessário

# Verificar rede
Get-NetAdapter | Where-Object {$_.Status -eq "Up"} | Get-NetAdapterStatistics
```

## 📚 Referências e Links Úteis

- [TightVNC Official Documentation](https://www.tightvnc.com/doc/)
- [Windows Server 2025 Documentation](https://docs.microsoft.com/en-us/windows-server/)
- [Python Windows Service Tutorial](https://docs.python.org/3/library/winreg.html)
- [Windows Firewall Configuration](https://docs.microsoft.com/en-us/powershell/module/netsecurity/)

## 🔄 Manutenção e Atualizações

### Atualização do Cliente

```powershell
# Parar serviço
Stop-Service -Name "YuStreamVNCClient"

# Backup da configuração
Copy-Item "C:\YuStreamVNC\vnc-client.config.json" "C:\YuStreamVNC\vnc-client.config.json.backup"

# Baixar nova versão
Invoke-WebRequest -Uri "https://your-yustream-server.com/vnc-client-windows-server.py" -OutFile "C:\YuStreamVNC\vnc-client.py"

# Iniciar serviço
Start-Service -Name "YuStreamVNCClient"
```

### Monitoramento Contínuo

```powershell
# Script de monitoramento
$monitorScript = @"
while ($true) {
    $service = Get-Service -Name "YuStreamVNCClient" -ErrorAction SilentlyContinue
    if ($service.Status -ne "Running") {
        Start-Service -Name "YuStreamVNCClient"
        Write-EventLog -LogName Application -Source "YuStream Monitor" -EventId 1001 -Message "YuStream VNC Client restarted"
    }
    Start-Sleep -Seconds 60
}
"@

# Executar como job em background
$monitorScript | Out-File -FilePath "C:\YuStreamVNC\monitor.ps1"
Start-Job -FilePath "C:\YuStreamVNC\monitor.ps1"
```

---

**⚠️ Importante**: Sempre teste as configurações em ambiente de desenvolvimento antes de aplicar em produção. Mantenha backups regulares das configurações e monitore os logs do sistema.
