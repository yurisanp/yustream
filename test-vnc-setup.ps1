# Script de teste para verificar configuração VNC YuStream
# Execute como Administrador

param(
    [string]$ServerUrl = "http://localhost:3003",
    [switch]$Verbose = $false
)

Write-Host "=== Teste de Configuração VNC YuStream ===" -ForegroundColor Green
Write-Host "Servidor: $ServerUrl" -ForegroundColor Cyan

$errors = @()
$warnings = @()

# Função para log
function Write-TestResult {
    param($Test, $Result, $Message, $Level = "Info")
    
    $symbol = switch ($Result) {
        "Pass" { "✅" }
        "Fail" { "❌" }
        "Warn" { "⚠️" }
    }
    
    $color = switch ($Level) {
        "Error" { "Red" }
        "Warning" { "Yellow" }
        default { "Green" }
    }
    
    Write-Host "$symbol $Test`: $Message" -ForegroundColor $color
    
    if ($Result -eq "Fail") {
        $script:errors += "$Test`: $Message"
    } elseif ($Result -eq "Warn") {
        $script:warnings += "$Test`: $Message"
    }
}

# 1. Verificar se está executando como administrador
Write-Host "`n1. Verificando privilégios..." -ForegroundColor Yellow
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
if ($isAdmin) {
    Write-TestResult "Privilégios" "Pass" "Executando como Administrador"
} else {
    Write-TestResult "Privilégios" "Fail" "Não está executando como Administrador" "Error"
}

# 2. Verificar Python
Write-Host "`n2. Verificando Python..." -ForegroundColor Yellow
try {
    $pythonVersion = python --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-TestResult "Python" "Pass" "Encontrado: $pythonVersion"
        
        # Verificar pip
        $pipVersion = pip --version 2>&1
        if ($LASTEXITCODE -eq 0) {
            Write-TestResult "Pip" "Pass" "Encontrado: $($pipVersion.Split(' ')[1])"
        } else {
            Write-TestResult "Pip" "Fail" "Não encontrado" "Error"
        }
        
        # Verificar dependências
        try {
            python -c "import requests; print('requests:', requests.__version__)" 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) {
                Write-TestResult "Requests" "Pass" "Biblioteca instalada"
            } else {
                Write-TestResult "Requests" "Fail" "Biblioteca não instalada" "Error"
            }
        } catch {
            Write-TestResult "Requests" "Fail" "Erro ao verificar biblioteca" "Error"
        }
        
    } else {
        Write-TestResult "Python" "Fail" "Não encontrado" "Error"
    }
} catch {
    Write-TestResult "Python" "Fail" "Erro ao verificar Python" "Error"
}

# 3. Verificar TightVNC
Write-Host "`n3. Verificando TightVNC..." -ForegroundColor Yellow
$vncPaths = @(
    "${env:ProgramFiles}\TightVNC\tvnserver.exe",
    "${env:ProgramFiles(x86)}\TightVNC\tvnserver.exe"
)

$vncFound = $false
foreach ($path in $vncPaths) {
    if (Test-Path $path) {
        Write-TestResult "TightVNC" "Pass" "Encontrado: $path"
        $vncFound = $true
        break
    }
}

if (-not $vncFound) {
    Write-TestResult "TightVNC" "Fail" "Não encontrado" "Error"
}

# Verificar serviço TightVNC
$vncService = Get-Service -Name "tvnserver" -ErrorAction SilentlyContinue
if ($vncService) {
    Write-TestResult "Serviço TightVNC" "Pass" "Status: $($vncService.Status)"
} else {
    Write-TestResult "Serviço TightVNC" "Warn" "Serviço não encontrado" "Warning"
}

# 4. Verificar portas
Write-Host "`n4. Verificando portas..." -ForegroundColor Yellow

# Porta VNC (5900)
$vncPort = Get-NetTCPConnection -LocalPort 5900 -ErrorAction SilentlyContinue
if ($vncPort) {
    Write-TestResult "Porta VNC (5900)" "Pass" "Em uso por: $($vncPort.OwningProcess)"
} else {
    Write-TestResult "Porta VNC (5900)" "Warn" "Não está sendo usada" "Warning"
}

# Porta HTTP VNC (5800)
$httpPort = Get-NetTCPConnection -LocalPort 5800 -ErrorAction SilentlyContinue
if ($httpPort) {
    Write-TestResult "Porta HTTP VNC (5800)" "Pass" "Em uso por: $($httpPort.OwningProcess)"
} else {
    Write-TestResult "Porta HTTP VNC (5800)" "Warn" "Não está sendo usada" "Warning"
}

# 5. Verificar firewall
Write-Host "`n5. Verificando firewall..." -ForegroundColor Yellow
$firewallRules = Get-NetFirewallRule -DisplayName "*VNC*" -ErrorAction SilentlyContinue
if ($firewallRules) {
    Write-TestResult "Regras Firewall" "Pass" "Encontradas $($firewallRules.Count) regra(s)"
    if ($Verbose) {
        foreach ($rule in $firewallRules) {
            Write-Host "  - $($rule.DisplayName): $($rule.Enabled)" -ForegroundColor Gray
        }
    }
} else {
    Write-TestResult "Regras Firewall" "Warn" "Nenhuma regra VNC encontrada" "Warning"
}

# 6. Verificar conectividade com servidor
Write-Host "`n6. Verificando conectividade..." -ForegroundColor Yellow
try {
    $serverUri = [Uri]$ServerUrl
    $connection = Test-NetConnection -ComputerName $serverUri.Host -Port $serverUri.Port -ErrorAction SilentlyContinue
    
    if ($connection.TcpTestSucceeded) {
        Write-TestResult "Conectividade" "Pass" "Conexão TCP estabelecida"
        
        # Testar endpoint de health
        try {
            $healthUrl = "$ServerUrl/health"
            $response = Invoke-RestMethod -Uri $healthUrl -TimeoutSec 10 -ErrorAction Stop
            Write-TestResult "Health Check" "Pass" "Servidor respondendo: $($response.status)"
        } catch {
            Write-TestResult "Health Check" "Warn" "Endpoint health não disponível: $($_.Exception.Message)" "Warning"
        }
        
    } else {
        Write-TestResult "Conectividade" "Fail" "Não foi possível conectar ao servidor" "Error"
    }
} catch {
    Write-TestResult "Conectividade" "Fail" "Erro ao testar conectividade: $($_.Exception.Message)" "Error"
}

# 7. Verificar arquivos de configuração
Write-Host "`n7. Verificando arquivos..." -ForegroundColor Yellow
$configPaths = @(
    "vnc-client.config.json",
    "vnc-client.py",
    "C:\Program Files\YuStreamVNCClient\vnc-client.config.json",
    "C:\YuStreamVNC\vnc-client.config.json"
)

$configFound = $false
foreach ($path in $configPaths) {
    if (Test-Path $path) {
        Write-TestResult "Arquivo Config" "Pass" "Encontrado: $path"
        $configFound = $true
        
        # Verificar conteúdo do JSON
        try {
            $config = Get-Content $path | ConvertFrom-Json
            Write-TestResult "Config JSON" "Pass" "Arquivo válido"
            if ($Verbose) {
                Write-Host "  - Server URL: $($config.server_url)" -ForegroundColor Gray
                Write-Host "  - Machine Name: $($config.machine_name)" -ForegroundColor Gray
                Write-Host "  - VNC Port: $($config.vnc_port)" -ForegroundColor Gray
            }
        } catch {
            Write-TestResult "Config JSON" "Fail" "Arquivo JSON inválido" "Error"
        }
        break
    }
}

if (-not $configFound) {
    Write-TestResult "Arquivo Config" "Warn" "Arquivo de configuração não encontrado" "Warning"
}

# 8. Verificar serviço YuStream
Write-Host "`n8. Verificando serviço YuStream..." -ForegroundColor Yellow
$yuStreamService = Get-Service -Name "YuStreamVNCClient" -ErrorAction SilentlyContinue
if ($yuStreamService) {
    Write-TestResult "Serviço YuStream" "Pass" "Status: $($yuStreamService.Status)"
    
    if ($yuStreamService.Status -eq "Running") {
        Write-TestResult "Serviço Running" "Pass" "Serviço está executando"
    } else {
        Write-TestResult "Serviço Running" "Warn" "Serviço não está executando" "Warning"
    }
} else {
    Write-TestResult "Serviço YuStream" "Warn" "Serviço não instalado" "Warning"
}

# 9. Verificar logs
Write-Host "`n9. Verificando logs..." -ForegroundColor Yellow
$logPaths = @(
    "vnc-client.log",
    "C:\Program Files\YuStreamVNCClient\vnc-client.log",
    "C:\YuStreamVNC\vnc-client.log"
)

$logFound = $false
foreach ($path in $logPaths) {
    if (Test-Path $path) {
        $logSize = (Get-Item $path).Length
        Write-TestResult "Arquivo Log" "Pass" "Encontrado: $path ($([math]::Round($logSize/1KB, 2)) KB)"
        $logFound = $true
        
        if ($Verbose) {
            Write-Host "  Últimas 5 linhas:" -ForegroundColor Gray
            Get-Content $path -Tail 5 | ForEach-Object { Write-Host "    $_" -ForegroundColor Gray }
        }
        break
    }
}

if (-not $logFound) {
    Write-TestResult "Arquivo Log" "Warn" "Arquivo de log não encontrado" "Warning"
}

# 10. Teste de registro (se possível)
Write-Host "`n10. Teste de registro..." -ForegroundColor Yellow
if ($configFound -and (Test-Path $configPaths[0])) {
    try {
        $config = Get-Content $configPaths[0] | ConvertFrom-Json
        $testData = @{
            "name" = "TEST-$env:COMPUTERNAME"
            "host" = "127.0.0.1"
            "vncPort" = $config.vnc_port
            "monitors" = 1
            "authToken" = $config.register_token
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri "$ServerUrl/api/vnc/register" -Method POST -ContentType "application/json" -Body $testData -TimeoutSec 10
        Write-TestResult "Teste Registro" "Pass" "Registro de teste bem-sucedido"
    } catch {
        Write-TestResult "Teste Registro" "Warn" "Falha no teste de registro: $($_.Exception.Message)" "Warning"
    }
} else {
    Write-TestResult "Teste Registro" "Warn" "Configuração não disponível para teste" "Warning"
}

# Resumo final
Write-Host "`n" + "="*50 -ForegroundColor Cyan
Write-Host "RESUMO DO TESTE" -ForegroundColor Cyan
Write-Host "="*50 -ForegroundColor Cyan

if ($errors.Count -eq 0 -and $warnings.Count -eq 0) {
    Write-Host "🎉 TODOS OS TESTES PASSARAM!" -ForegroundColor Green
    Write-Host "O sistema VNC está configurado corretamente." -ForegroundColor Green
} elseif ($errors.Count -eq 0) {
    Write-Host "✅ TESTES PRINCIPAIS PASSARAM" -ForegroundColor Green
    Write-Host "⚠️ $($warnings.Count) aviso(s) encontrado(s):" -ForegroundColor Yellow
    foreach ($warning in $warnings) {
        Write-Host "  - $warning" -ForegroundColor Yellow
    }
} else {
    Write-Host "❌ $($errors.Count) ERRO(S) ENCONTRADO(S):" -ForegroundColor Red
    foreach ($error in $errors) {
        Write-Host "  - $error" -ForegroundColor Red
    }
    
    if ($warnings.Count -gt 0) {
        Write-Host "⚠️ $($warnings.Count) aviso(s) encontrado(s):" -ForegroundColor Yellow
        foreach ($warning in $warnings) {
            Write-Host "  - $warning" -ForegroundColor Yellow
        }
    }
}

Write-Host "`n📖 Para mais informações, consulte:" -ForegroundColor Cyan
Write-Host "  - VNC_REMOTE_ACCESS_DOCUMENTATION.md" -ForegroundColor Gray
Write-Host "  - WINDOWS_SERVER_2025_SETUP.md" -ForegroundColor Gray

if ($errors.Count -gt 0) {
    exit 1
} else {
    exit 0
}
