# 🚀 Configuração Automática de Túnel SSH - YuStream VNC

## 📋 Visão Geral

Este script configura automaticamente um túnel SSH reverso seguro entre o Windows Server 2025 e o servidor YuStream, permitindo controle VNC total sem exposição de portas.

## 🎯 Como Funciona

### **Túnel SSH Reverso**
```
[Windows Server] ----SSH----> [Servidor YuStream]
      ↓                              ↑
  TightVNC:5900              Acesso via túnel
  (localhost only)           (porta dinâmica)
```

### **Fluxo Automático**
1. **Cliente conecta** ao servidor via SSH
2. **Túnel reverso** criado automaticamente
3. **Servidor acessa** VNC do cliente via túnel
4. **Controle total** através de conexão segura

## 🚀 Uso Simples - Um Comando Apenas

### **Execução Automática**
```powershell
# Execute como Administrador
.\setup-auto-tunnel.ps1 -ServerUrl "https://your-yustream-server.com" -RegisterToken "your-token" -ServerSSHPassword "server-ssh-password"
```

### **Parâmetros**
- **ServerUrl**: URL do servidor YuStream
- **RegisterToken**: Token de registro VNC
- **ServerSSHPassword**: Senha SSH do servidor YuStream
- **MachineName**: Nome da máquina (padrão: nome do computador)
- **VNCPassword**: Senha do TightVNC (padrão: YuStreamVNC123!)
- **InstallAsService**: Instalar como serviço Windows (padrão: true)

## 🔧 O Que o Script Faz Automaticamente

### **1. Configuração SSH Server**
- ✅ Instala OpenSSH Server
- ✅ Configura serviço para inicialização automática
- ✅ Cria regras de firewall
- ✅ Cria usuário SSH dedicado (yustream_ssh)

### **2. Configuração TightVNC**
- ✅ Baixa e instala TightVNC automaticamente
- ✅ Configura para localhost apenas (segurança)
- ✅ Define senha VNC
- ✅ Bloqueia acesso externo via firewall

### **3. Configuração Python**
- ✅ Instala Python 3.11 se necessário
- ✅ Instala dependências (requests, paramiko)
- ✅ Configura PATH automaticamente

### **4. Configuração Cliente VNC**
- ✅ Cria arquivo de configuração completo
- ✅ Habilita túnel SSH reverso
- ✅ Detecta número de monitores
- ✅ Baixa cliente Python do servidor

### **5. Scripts de Gerenciamento**
- ✅ Script de inicialização
- ✅ Script de configuração
- ✅ Script de teste
- ✅ Atalhos no desktop

### **6. Serviço Windows**
- ✅ Instala como serviço Windows
- ✅ Inicialização automática
- ✅ Gerenciamento via Services.msc

## 📊 Configuração Gerada

### **Arquivo de Configuração**
```json
{
  "server_url": "https://your-yustream-server.com",
  "register_token": "your-token",
  "machine_name": "STREAMING-SERVER-01",
  "vnc_port": 5900,
  "monitors": 2,
  "ssh_enabled": true,
  "ssh_port": 22,
  "ssh_username": "yustream_ssh",
  "ssh_password": "YuStreamSSH123!",
  "reverse_tunnel_enabled": true,
  "server_ssh_host": "your-server.com",
  "server_ssh_port": 22,
  "server_ssh_username": "yustream",
  "server_ssh_password": "server-password",
  "heartbeat_interval": 30,
  "auto_start_vnc": true,
  "vnc_password": "YuStreamVNC123!"
}
```

## 🔒 Segurança Implementada

### **1. VNC Protegido**
- **Localhost apenas**: TightVNC não aceita conexões externas
- **Firewall**: Bloqueia porta 5900 do exterior
- **Senha obrigatória**: Autenticação VNC ativa

### **2. SSH Seguro**
- **Usuário dedicado**: yustream_ssh com permissões limitadas
- **Túnel criptografado**: Toda comunicação via SSH
- **Porta específica**: Apenas porta 22 exposta

### **3. Acesso Controlado**
- **Token de registro**: Apenas clientes autorizados
- **Logs completos**: Todas as ações registradas
- **Timeouts**: Sessões expiram automaticamente

## 🎮 Como Usar Após Configuração

### **1. Iniciar Sistema**
```powershell
# Via atalho do desktop
# Ou via serviço
Start-Service -Name "YuStreamVNCTunnel"

# Ou manualmente
cd "C:\Program Files\YuStreamVNCClient"
python vnc-client.py
```

### **2. Acessar via Web**
```
1. Login como admin no YuStream
2. Ir para /admin → aba "VNC Remoto"
3. Aguardar conexão aparecer na lista
4. Clicar para conectar
5. Controle total do desktop remoto
```

### **3. Verificar Status**
```powershell
# Status do serviço
Get-Service -Name "YuStreamVNCTunnel"

# Logs do cliente
Get-Content -Path "C:\Program Files\YuStreamVNCClient\vnc-client.log" -Tail 20

# Testar VNC local
telnet localhost 5900
```

## 🛠️ Troubleshooting

### **Problema: Túnel SSH não conecta**
```powershell
# Verificar SSH no servidor YuStream
ssh yustream@your-server.com

# Verificar configuração
notepad "C:\Program Files\YuStreamVNCClient\vnc-client.config.json"
```

### **Problema: VNC não responde**
```powershell
# Verificar TightVNC
Get-Service tvnserver
Restart-Service tvnserver

# Testar localmente
telnet localhost 5900
```

### **Problema: Serviço não inicia**
```powershell
# Verificar logs do Windows
Get-WinEvent -FilterHashtable @{LogName='System'; ProviderName='Service Control Manager'} | Where-Object {$_.Message -like "*YuStream*"}

# Executar manualmente para debug
cd "C:\Program Files\YuStreamVNCClient"
python vnc-client.py
```

## 🎯 Vantagens do Túnel Automático

### **✅ Segurança**
- **Sem exposição VNC**: Porta 5900 não exposta na internet
- **Criptografia SSH**: Toda comunicação criptografada
- **Autenticação dupla**: SSH + VNC passwords

### **✅ Simplicidade**
- **Um comando**: Script faz tudo automaticamente
- **Zero configuração manual**: Tudo detectado e configurado
- **Atalhos prontos**: Desktop shortcuts criados

### **✅ Confiabilidade**
- **Reconexão automática**: Túnel SSH se reconecta se cair
- **Monitoramento**: Heartbeat e health checks
- **Logs detalhados**: Troubleshooting facilitado

### **✅ Escalabilidade**
- **Múltiplas máquinas**: Cada uma com seu túnel
- **Portas dinâmicas**: Sem conflitos de porta
- **Gerenciamento central**: Tudo via interface web

---

**🎊 Configuração automática completa - túnel SSH reverso funcionando com um comando!**
