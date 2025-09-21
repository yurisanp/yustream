#!/usr/bin/env python3
"""
Cliente VNC para YuStream - Conecta máquinas remotas ao servidor central
"""

import os
import sys
import time
import json
import socket
import subprocess
import threading
import requests
import argparse
from datetime import datetime
import logging
import paramiko
import select

# Configuração de logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('vnc-client.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

class VNCClient:
    def __init__(self, config_file='vnc-client.config.json'):
        self.config_file = config_file
        self.config = self.load_config()
        self.connection_id = None
        self.running = False
        self.heartbeat_thread = None
        self.ssh_tunnel = None
        self.tunnel_thread = None
        self.reverse_tunnel_port = None
        
    def load_config(self):
        """Carrega configuração do arquivo JSON"""
        default_config = {
            "server_url": "https://your-yustream-server.com",
            "register_token": "yustream-vnc-register-token",
            "machine_name": socket.gethostname(),
            "vnc_port": 5900,
            "monitors": 1,
            "ssh_enabled": True,
            "ssh_port": 22,
            "ssh_username": "",
            "ssh_password": "",
            "ssh_private_key_path": "",
            "reverse_tunnel_enabled": True,
            "server_ssh_host": "",
            "server_ssh_port": 22,
            "server_ssh_username": "yustream",
            "server_ssh_password": "",
            "heartbeat_interval": 30,
            "auto_start_vnc": True,
            "vnc_password": "",
            "display": ":0"
        }
        
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r') as f:
                    config = json.load(f)
                    # Mesclar com configuração padrão
                    default_config.update(config)
                    return default_config
            except Exception as e:
                logger.error(f"Erro ao carregar configuração: {e}")
                return default_config
        else:
            # Criar arquivo de configuração padrão
            with open(self.config_file, 'w') as f:
                json.dump(default_config, f, indent=2)
            logger.info(f"Arquivo de configuração criado: {self.config_file}")
            return default_config
    
    def save_config(self):
        """Salva configuração no arquivo"""
        try:
            with open(self.config_file, 'w') as f:
                json.dump(self.config, f, indent=2)
        except Exception as e:
            logger.error(f"Erro ao salvar configuração: {e}")
    
    def detect_system_info(self):
        """Detecta informações do sistema"""
        try:
            # Detectar número de monitores
            if sys.platform.startswith('linux'):
                result = subprocess.run(['xrandr', '--listmonitors'], 
                                      capture_output=True, text=True)
                if result.returncode == 0:
                    lines = result.stdout.strip().split('\n')
                    self.config['monitors'] = len([line for line in lines if 'Monitor' in line])
            
            elif sys.platform.startswith('win'):
                # Windows - usar wmic
                result = subprocess.run(['wmic', 'desktopmonitor', 'get', 'name'], 
                                      capture_output=True, text=True)
                if result.returncode == 0:
                    lines = [line.strip() for line in result.stdout.split('\n') if line.strip() and 'Name' not in line]
                    self.config['monitors'] = len(lines)
            
            elif sys.platform.startswith('darwin'):
                # macOS - usar system_profiler
                result = subprocess.run(['system_profiler', 'SPDisplaysDataType'], 
                                      capture_output=True, text=True)
                if result.returncode == 0:
                    self.config['monitors'] = result.stdout.count('Display Type:')
            
            logger.info(f"Detectados {self.config['monitors']} monitor(s)")
            
        except Exception as e:
            logger.warning(f"Erro ao detectar informações do sistema: {e}")
    
    def setup_vnc_server(self):
        """Configura e inicia servidor VNC se necessário"""
        if not self.config.get('auto_start_vnc', True):
            return True
            
        try:
            if sys.platform.startswith('linux'):
                return self.setup_vnc_linux()
            elif sys.platform.startswith('win'):
                return self.setup_vnc_windows()
            elif sys.platform.startswith('darwin'):
                return self.setup_vnc_macos()
            else:
                logger.error(f"Sistema operacional não suportado: {sys.platform}")
                return False
                
        except Exception as e:
            logger.error(f"Erro ao configurar servidor VNC: {e}")
            return False
    
    def setup_vnc_linux(self):
        """Configurar VNC no Linux"""
        logger.info("Configurando servidor VNC no Linux...")
        
        # Verificar se x11vnc está instalado
        result = subprocess.run(['which', 'x11vnc'], capture_output=True)
        if result.returncode != 0:
            logger.error("x11vnc não encontrado. Instale com: sudo apt-get install x11vnc")
            return False
        
        # Parar qualquer instância anterior
        subprocess.run(['pkill', '-f', 'x11vnc'], capture_output=True)
        
        # Comando x11vnc
        cmd = [
            'x11vnc',
            '-display', self.config.get('display', ':0'),
            '-rfbport', str(self.config['vnc_port']),
            '-shared',
            '-forever',
            '-noxdamage',
            '-noxfixes',
            '-noxrandr',
            '-bg'
        ]
        
        if self.config.get('vnc_password'):
            # Criar arquivo de senha
            password_file = '/tmp/vnc_passwd'
            with open(password_file, 'w') as f:
                f.write(self.config['vnc_password'])
            os.chmod(password_file, 0o600)
            cmd.extend(['-rfbauth', password_file])
        else:
            cmd.append('-nopw')
        
        # Iniciar x11vnc
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode == 0:
            logger.info("Servidor VNC iniciado com sucesso")
            return True
        else:
            logger.error(f"Erro ao iniciar VNC: {result.stderr}")
            return False
    
    def setup_vnc_windows(self):
        """Configurar VNC no Windows"""
        logger.info("Configurando servidor VNC no Windows...")
        
        # Verificar se TightVNC ou UltraVNC está instalado
        vnc_paths = [
            r"C:\Program Files\TightVNC\tvnserver.exe",
            r"C:\Program Files (x86)\TightVNC\tvnserver.exe",
            r"C:\Program Files\UltraVNC\winvnc.exe",
            r"C:\Program Files (x86)\UltraVNC\winvnc.exe"
        ]
        
        vnc_exe = None
        for path in vnc_paths:
            if os.path.exists(path):
                vnc_exe = path
                break
        
        if not vnc_exe:
            logger.error("Servidor VNC não encontrado. Instale TightVNC ou UltraVNC")
            return False
        
        # Iniciar servidor VNC
        try:
            if "tightvnc" in vnc_exe.lower():
                cmd = [vnc_exe, "-run"]
            else:  # UltraVNC
                cmd = [vnc_exe, "-run"]
            
            subprocess.Popen(cmd)
            logger.info("Servidor VNC iniciado com sucesso")
            return True
            
        except Exception as e:
            logger.error(f"Erro ao iniciar VNC: {e}")
            return False
    
    def setup_vnc_macos(self):
        """Configurar VNC no macOS"""
        logger.info("Configurando servidor VNC no macOS...")
        
        try:
            # Habilitar VNC no macOS
            subprocess.run([
                'sudo', 'launchctl', 'load', '-w',
                '/System/Library/LaunchDaemons/com.apple.screensharing.plist'
            ], check=True)
            
            logger.info("Screen Sharing habilitado no macOS")
            return True
            
        except subprocess.CalledProcessError as e:
            logger.error(f"Erro ao habilitar Screen Sharing: {e}")
            return False
    
    def register_with_server(self):
        """Registra esta máquina com o servidor YuStream"""
        logger.info("Registrando com servidor YuStream...")
        
        # Preparar dados de registro
        registration_data = {
            "name": self.config['machine_name'],
            "host": self.get_public_ip(),
            "vncPort": self.config['vnc_port'],
            "monitors": self.config['monitors'],
            "authToken": self.config['register_token']
        }
        
        # Adicionar informações SSH se habilitado
        if self.config.get('ssh_enabled', True):
            registration_data.update({
                "sshEnabled": True,
                "sshUsername": self.config.get('ssh_username'),
                "sshPassword": self.config.get('ssh_password'),
                "sshPort": self.config.get('ssh_port', 22)
            })
            
            # Carregar chave privada SSH se especificada
            ssh_key_path = self.config.get('ssh_private_key_path')
            if ssh_key_path and os.path.exists(ssh_key_path):
                with open(ssh_key_path, 'r') as f:
                    registration_data['sshPrivateKey'] = f.read()
        
        # Se túnel reverso está habilitado, incluir informações do túnel
        if self.config.get('reverse_tunnel_enabled', False):
            registration_data.update({
                "reverseTunnelEnabled": True,
                "tunnelType": "ssh_reverse",
                "localVNCPort": self.config['vnc_port'],
                "tunnelPort": self.reverse_tunnel_port
            })
        
        try:
            response = requests.post(
                f"{self.config['server_url']}/api/vnc/register",
                json=registration_data,
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                self.connection_id = data['connectionId']
                logger.info(f"Registrado com sucesso. ID: {self.connection_id}")
                return True
            else:
                logger.error(f"Erro no registro: {response.status_code} - {response.text}")
                return False
                
        except Exception as e:
            logger.error(f"Erro ao conectar com servidor: {e}")
            return False
    
    def get_public_ip(self):
        """Obtém IP público da máquina"""
        try:
            # Tentar vários serviços
            services = [
                "https://api.ipify.org",
                "https://httpbin.org/ip",
                "https://icanhazip.com"
            ]
            
            for service in services:
                try:
                    response = requests.get(service, timeout=5)
                    if response.status_code == 200:
                        if service == "https://httpbin.org/ip":
                            return response.json()['origin'].split(',')[0].strip()
                        else:
                            return response.text.strip()
                except:
                    continue
            
            # Fallback: IP local
            return self.get_local_ip()
            
        except Exception as e:
            logger.warning(f"Erro ao obter IP público: {e}")
            return self.get_local_ip()
    
    def get_local_ip(self):
        """Obtém IP local da máquina"""
        try:
            # Conectar a um endereço externo para descobrir IP local
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except:
            return "127.0.0.1"
    
    def create_reverse_ssh_tunnel(self):
        """Cria túnel SSH reverso para o servidor YuStream"""
        if not self.config.get('reverse_tunnel_enabled', False):
            logger.info("Túnel SSH reverso desabilitado na configuração")
            return False
            
        try:
            # Configurações do túnel
            server_host = self.config.get('server_ssh_host')
            server_port = self.config.get('server_ssh_port', 22)
            server_user = self.config.get('server_ssh_username', 'yustream')
            server_pass = self.config.get('server_ssh_password', '')
            
            if not server_host:
                # Extrair host do server_url
                from urllib.parse import urlparse
                parsed_url = urlparse(self.config['server_url'])
                server_host = parsed_url.hostname
                
            if not server_host:
                logger.error("Host do servidor não configurado para túnel SSH")
                return False
            
            logger.info(f"Criando túnel SSH reverso para {server_user}@{server_host}:{server_port}")
            
            # Criar cliente SSH
            ssh_client = paramiko.SSHClient()
            ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            
            # Conectar ao servidor
            ssh_client.connect(
                hostname=server_host,
                port=server_port,
                username=server_user,
                password=server_pass,
                timeout=30
            )
            
            # Criar túnel reverso (servidor pode conectar de volta ao cliente)
            # Porta remota aleatória será atribuída pelo servidor
            transport = ssh_client.get_transport()
            
            # Solicitar porta livre no servidor
            remote_port = 0  # 0 = porta automática
            local_host = '127.0.0.1'
            local_port = self.config['vnc_port']
            
            # Criar reverse tunnel
            try:
                # Usar reverse port forwarding
                transport.request_port_forward('', remote_port)
                logger.info(f"Túnel SSH reverso criado: servidor pode acessar localhost:{local_port}")
                
                self.ssh_tunnel = ssh_client
                self.reverse_tunnel_port = remote_port
                
                # Manter túnel ativo em thread separada
                self.tunnel_thread = threading.Thread(target=self._maintain_ssh_tunnel)
                self.tunnel_thread.daemon = True
                self.tunnel_thread.start()
                
                return True
                
            except Exception as e:
                logger.error(f"Erro ao criar reverse port forward: {e}")
                ssh_client.close()
                return False
                
        except Exception as e:
            logger.error(f"Erro ao criar túnel SSH: {e}")
            return False
    
    def _maintain_ssh_tunnel(self):
        """Mantém o túnel SSH ativo"""
        while self.running and self.ssh_tunnel:
            try:
                # Verificar se conexão SSH ainda está ativa
                transport = self.ssh_tunnel.get_transport()
                if not transport or not transport.is_active():
                    logger.warning("Túnel SSH perdido, tentando reconectar...")
                    self.create_reverse_ssh_tunnel()
                    break
                
                time.sleep(30)  # Verificar a cada 30 segundos
                
            except Exception as e:
                logger.error(f"Erro ao manter túnel SSH: {e}")
                break
    
    def close_ssh_tunnel(self):
        """Fecha o túnel SSH"""
        if self.ssh_tunnel:
            try:
                self.ssh_tunnel.close()
                logger.info("Túnel SSH fechado")
            except:
                pass
            self.ssh_tunnel = None
    
    def send_heartbeat(self):
        """Envia heartbeat para o servidor"""
        if not self.connection_id:
            return
            
        try:
            response = requests.put(
                f"{self.config['server_url']}/api/vnc/heartbeat/{self.connection_id}",
                json={"status": "connected"},
                timeout=10
            )
            
            if response.status_code == 200:
                logger.debug("Heartbeat enviado com sucesso")
            else:
                logger.warning(f"Erro no heartbeat: {response.status_code}")
                
        except Exception as e:
            logger.warning(f"Erro ao enviar heartbeat: {e}")
    
    def heartbeat_loop(self):
        """Loop de heartbeat em thread separada"""
        while self.running:
            self.send_heartbeat()
            time.sleep(self.config.get('heartbeat_interval', 30))
    
    def start(self):
        """Inicia o cliente VNC"""
        logger.info("Iniciando cliente VNC YuStream...")
        
        # Detectar informações do sistema
        self.detect_system_info()
        
        # Configurar servidor VNC
        if not self.setup_vnc_server():
            logger.error("Falha ao configurar servidor VNC")
            return False
        
        # Aguardar um pouco para o VNC inicializar
        time.sleep(2)
        
        # Criar túnel SSH reverso se habilitado
        if self.config.get('reverse_tunnel_enabled', False):
            logger.info("Criando túnel SSH reverso...")
            if not self.create_reverse_ssh_tunnel():
                logger.error("Falha ao criar túnel SSH reverso")
                return False
        
        # Registrar com servidor
        if not self.register_with_server():
            logger.error("Falha ao registrar com servidor")
            return False
        
        # Iniciar loop de heartbeat
        self.running = True
        self.heartbeat_thread = threading.Thread(target=self.heartbeat_loop)
        self.heartbeat_thread.daemon = True
        self.heartbeat_thread.start()
        
        logger.info("Cliente VNC iniciado com sucesso")
        logger.info(f"ID da conexão: {self.connection_id}")
        logger.info(f"Porta VNC: {self.config['vnc_port']}")
        logger.info(f"Monitores: {self.config['monitors']}")
        
        return True
    
    def stop(self):
        """Para o cliente VNC"""
        logger.info("Parando cliente VNC...")
        
        self.running = False
        
        # Fechar túnel SSH
        self.close_ssh_tunnel()
        
        if self.heartbeat_thread:
            self.heartbeat_thread.join(timeout=5)
        
        if self.tunnel_thread:
            self.tunnel_thread.join(timeout=5)
        
        logger.info("Cliente VNC parado")
    
    def run_interactive(self):
        """Executa em modo interativo"""
        try:
            if self.start():
                logger.info("Pressione Ctrl+C para parar...")
                while True:
                    time.sleep(1)
        except KeyboardInterrupt:
            logger.info("Interrupção recebida...")
        finally:
            self.stop()

def main():
    parser = argparse.ArgumentParser(description='Cliente VNC para YuStream')
    parser.add_argument('--config', '-c', default='vnc-client.config.json',
                        help='Arquivo de configuração (padrão: vnc-client.config.json)')
    parser.add_argument('--setup', action='store_true',
                        help='Executar configuração inicial')
    parser.add_argument('--daemon', '-d', action='store_true',
                        help='Executar como daemon')
    
    args = parser.parse_args()
    
    client = VNCClient(args.config)
    
    if args.setup:
        print("=== Configuração do Cliente VNC YuStream ===")
        client.config['server_url'] = input(f"URL do servidor [{client.config['server_url']}]: ") or client.config['server_url']
        client.config['register_token'] = input(f"Token de registro [{client.config['register_token']}]: ") or client.config['register_token']
        client.config['machine_name'] = input(f"Nome da máquina [{client.config['machine_name']}]: ") or client.config['machine_name']
        client.config['vnc_port'] = int(input(f"Porta VNC [{client.config['vnc_port']}]: ") or client.config['vnc_port'])
        
        ssh_enabled = input(f"Habilitar SSH? [s/N]: ").lower().startswith('s')
        client.config['ssh_enabled'] = ssh_enabled
        
        if ssh_enabled:
            client.config['ssh_username'] = input(f"Usuário SSH [{client.config['ssh_username']}]: ") or client.config['ssh_username']
            client.config['ssh_password'] = input(f"Senha SSH (deixe vazio para chave): ") or client.config['ssh_password']
            if not client.config['ssh_password']:
                client.config['ssh_private_key_path'] = input(f"Caminho da chave privada [{client.config['ssh_private_key_path']}]: ") or client.config['ssh_private_key_path']
        
        client.save_config()
        print(f"Configuração salva em {args.config}")
        return
    
    if args.daemon:
        # TODO: Implementar modo daemon para sistemas Unix
        logger.error("Modo daemon não implementado ainda")
        return
    
    # Executar em modo interativo
    client.run_interactive()

if __name__ == '__main__':
    main()
