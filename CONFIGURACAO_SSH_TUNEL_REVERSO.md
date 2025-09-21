# Configuração de Túnel SSH Reverso para VNC

## 🎯 Problema e Solução

### **Problema Identificado**
- **Conexão direta falha**: Servidor YuStream não consegue conectar diretamente ao VNC do cliente
- **IP público**: Cliente tem IP 45.190.118.113 mas VNC roda apenas em localhost
- **Firewall/NAT**: Bloqueios de rede impedem conexão direta na porta 5900

### **Solução: Túnel SSH Reverso**
- **Cliente inicia túnel**: Máquina remota conecta ao servidor YuStream
- **Proxy seguro**: SSH cria túnel criptografado
- **VNC local**: Servidor acessa VNC via túnel SSH

## 🔧 Configuração no Windows Server 2025

### **1. Habilitar SSH Server**

#### **Instalar OpenSSH Server**
```powershell
# Execute como Administrador
Add-WindowsCapability -Online -Name OpenSSH.Server~~~~0.0.1.0

# Iniciar e habilitar serviço
Start-Service sshd
Set-Service -Name sshd -StartupType 'Automatic'

# Configurar firewall
New-NetFirewallRule -Name sshd -DisplayName 'OpenSSH Server (sshd)' -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22
```

#### **Configurar SSH**
```powershell
# Editar configuração SSH
notepad C:\ProgramData\ssh\sshd_config

# Adicionar/modificar linhas:
# PasswordAuthentication yes
# PubkeyAuthentication yes
# PermitRootLogin no
# AllowUsers streaming_user

# Reiniciar serviço
Restart-Service sshd
```

### **2. Criar Usuário SSH**
```powershell
# Criar usuário específico para SSH
$password = ConvertTo-SecureString "SecurePassword123!" -AsPlainText -Force
New-LocalUser -Name "streaming_user" -Password $password -Description "Usuário para túnel SSH VNC"

# Adicionar ao grupo de usuários remotos
Add-LocalGroupMember -Group "Remote Desktop Users" -Member "streaming_user"
```

### **3. Configurar TightVNC para Localhost**
```powershell
# Configurar TightVNC para aceitar apenas conexões locais
$regPath = "HKLM:\SOFTWARE\TightVNC\Server"
Set-ItemProperty -Path $regPath -Name "AcceptRfbConnections" -Value 1
Set-ItemProperty -Path $regPath -Name "RfbPort" -Value 5900
Set-ItemProperty -Path $regPath -Name "LocalhostOnly" -Value 1  # IMPORTANTE!
Set-ItemProperty -Path $regPath -Name "UseAuthentication" -Value 1

# Reiniciar serviço TightVNC
Restart-Service tvnserver
```

### **4. Atualizar Cliente VNC YuStream**

#### **Configuração com SSH**
```json
{
  "server_url": "https://your-yustream-server.com",
  "register_token": "your-register-token",
  "machine_name": "STREAMING-SERVER-01",
  "vnc_port": 5900,
  "monitors": 2,
  "ssh_enabled": true,
  "ssh_port": 22,
  "ssh_username": "streaming_user",
  "ssh_password": "SecurePassword123!",
  "ssh_private_key_path": "",
  "heartbeat_interval": 30,
  "auto_start_vnc": true,
  "vnc_password": "vnc-secure-password",
  "display": ":0"
}
```

#### **Executar Cliente**
```powershell
# No diretório do cliente VNC
python vnc-client.py
```

## 🔄 Como Funciona o Túnel SSH Reverso

### **Fluxo de Conexão**
```
[Cliente Windows] ←SSH→ [Servidor YuStream] ←WebSocket→ [Frontend Web]
      ↓                        ↓                           ↓
  TightVNC:5900          Túnel SSH Local            Interface noVNC
  (localhost only)       (porta dinâmica)           (controle total)
```

### **Processo Detalhado**
1. **Cliente registra**: Envia dados de SSH junto com registro
2. **Usuário conecta**: Frontend solicita sessão VNC
3. **Servidor cria túnel**: SSH para cliente com forward local
4. **Proxy WebSocket**: Conecta ao VNC via túnel SSH
5. **Controle total**: Mouse/teclado enviados via túnel seguro

## 🔒 Configuração de Segurança

### **1. Chaves SSH (Recomendado)**
```powershell
# Gerar par de chaves SSH
ssh-keygen -t rsa -b 4096 -f C:\Users\streaming_user\.ssh\id_rsa

# Copiar chave pública para servidor YuStream
# (configurar no cliente Python)
```

### **2. Firewall Restritivo**
```powershell
# Permitir SSH apenas do servidor YuStream
New-NetFirewallRule -DisplayName "SSH YuStream" -Direction Inbound -Protocol TCP -LocalPort 22 -Action Allow -RemoteAddress "YOUR_YUSTREAM_SERVER_IP"

# Bloquear VNC do exterior (apenas localhost)
New-NetFirewallRule -DisplayName "VNC Block External" -Direction Inbound -Protocol TCP -LocalPort 5900 -Action Block -RemoteAddress "!127.0.0.1"
```

### **3. Configuração VNC Segura**
```powershell
# TightVNC apenas localhost + senha
Set-ItemProperty -Path "HKLM:\SOFTWARE\TightVNC\Server" -Name "LocalhostOnly" -Value 1
Set-ItemProperty -Path "HKLM:\SOFTWARE\TightVNC\Server" -Name "UseAuthentication" -Value 1
# Definir senha forte via interface TightVNC
```

## 🧪 Teste de Conectividade

### **1. Teste SSH**
```bash
# Do servidor YuStream
ssh streaming_user@45.190.118.113
```

### **2. Teste Túnel SSH**
```bash
# Criar túnel manual para teste
ssh -L 5901:localhost:5900 streaming_user@45.190.118.113

# Testar VNC via túnel
vncviewer localhost:5901
```

### **3. Teste VNC Local**
```powershell
# No Windows Server (localmente)
telnet localhost 5900
# Deve conectar ao TightVNC
```

## 🛠️ Troubleshooting

### **Problema: SSH não conecta**
```powershell
# Verificar serviço SSH
Get-Service sshd

# Verificar logs SSH
Get-WinEvent -FilterHashtable @{LogName='OpenSSH/Operational'}

# Testar porta SSH
Test-NetConnection -ComputerName localhost -Port 22
```

### **Problema: VNC não aceita conexões**
```powershell
# Verificar TightVNC
Get-Service tvnserver

# Verificar porta VNC
Get-NetTCPConnection -LocalPort 5900

# Testar localmente
telnet localhost 5900
```

### **Problema: Túnel SSH falha**
```bash
# Debug SSH
ssh -v streaming_user@45.190.118.113

# Verificar autenticação
ssh -o PreferredAuthentications=password streaming_user@45.190.118.113
```

## 📊 Configuração Completa

### **Arquivo de Configuração Final**
```json
{
  "server_url": "https://your-yustream-server.com",
  "register_token": "yustream-vnc-register-token-change-in-production",
  "machine_name": "STREAMING-SERVER-01",
  "vnc_port": 5900,
  "monitors": 2,
  "ssh_enabled": true,
  "ssh_port": 22,
  "ssh_username": "streaming_user",
  "ssh_password": "SecurePassword123!",
  "ssh_private_key_path": "C:\\Users\\streaming_user\\.ssh\\id_rsa",
  "heartbeat_interval": 30,
  "auto_start_vnc": true,
  "vnc_password": "VNCSecurePass123!",
  "display": ":0"
}
```

### **Logs Esperados no Servidor**
```
✅ "Túnel SSH estabelecido para 45.190.118.113"
✅ "Conectado via túnel SSH ao VNC 45.190.118.113:5900"
✅ "Proxy WebSocket VNC criado na porta 6171"
✅ "Nova conexão WebSocket VNC na porta 6171"
```

## 🎯 **Próximos Passos**

1. **Configure SSH** no Windows Server 2025
2. **Configure usuário** streaming_user
3. **Configure TightVNC** para localhost only
4. **Atualize configuração** do cliente Python
5. **Teste conexão** SSH manualmente
6. **Execute cliente** VNC YuStream
7. **Teste interface** web VNC

**🎊 Com túnel SSH, o controle VNC funcionará perfeitamente através de firewall/NAT!**
