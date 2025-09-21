#!/usr/bin/env python3
"""
Cliente VNC para YuStream - Windows Server 2025
Versão otimizada para Windows Server com integração nativa
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
import winreg
import win32service
import win32serviceutil
import win32event
from datetime import datetime
import logging

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

class WindowsVNCService(win32serviceutil.ServiceFramework):
    """Serviço Windows para o cliente VNC"""
    _svc_name_ = "YuStreamVNCClient"
    _svc_display_name_ = "YuStream VNC Client"
    _svc_description_ = "Cliente VNC para acesso remoto YuStream"
    
    def __init__(self, args):
        win32serviceutil.ServiceFramework.__init__(self, args)
        self.hWaitStop = win32event.CreateEvent(None, 0, 0, None)
        self.client = None
        
    def SvcStop(self):
        self.ReportServiceStatus(win32service.SERVICE_STOP_PENDING)
        win32event.SetEvent(self.hWaitStop)
        if self.client:
            self.client.stop()
            
    def SvcDoRun(self):
        self.client = VNCClient()
        self.client.start()
        
        # Aguardar sinal de parada
        win32event.WaitForSingleObject(self.hWaitStop, win32event.INFINITE)

class VNCClient:
    def __init__(self, config_file='vnc-client.config.json'):
        self.config_file = config_file
        self.config = self.load_config()
        self.connection_id = None
        self.running = False
        self.heartbeat_thread = None
        self.vnc_process = None
        
    def load_config(self):
        """Carrega configuração do arquivo JSON"""
        default_config = {
            "server_url": "https://your-yustream-server.com",
            "register_token": "yustream-vnc-register-token",
            "machine_name": socket.gethostname(),
            "vnc_port": 5900,
            "monitors": 1,
            "ssh_enabled": False,
            "ssh_port": 22,
            "ssh_username": "",
            "ssh_password": "",
            "ssh_private_key_path": "",
            "heartbeat_interval": 30,
            "auto_start_vnc": True,
            "vnc_password": "",
            "display": ":0",
            "tightvnc_path": "",
            "vnc_http_port": 5800
        }
        
        if os.path.exists(self.config_file):
            try:
                with open(self.config_file, 'r', encoding='utf-8') as f:
                    config = json.load(f)
                    default_config.update(config)
                    return default_config
            except Exception as e:
                logger.error(f"Erro ao carregar configuração: {e}")
                return default_config
        else:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(default_config, f, indent=2, ensure_ascii=False)
            logger.info(f"Arquivo de configuração criado: {self.config_file}")
            return default_config
    
    def save_config(self):
        """Salva configuração no arquivo"""
        try:
            with open(self.config_file, 'w', encoding='utf-8') as f:
                json.dump(self.config, f, indent=2, ensure_ascii=False)
        except Exception as e:
            logger.error(f"Erro ao salvar configuração: {e}")
    
    def detect_system_info(self):
        """Detecta informações do sistema Windows"""
        try:
            # Detectar número de monitores usando registry
            try:
                key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, 
                                   r"SYSTEM\CurrentControlSet\Control\GraphicsDrivers\Configuration")
                monitor_count = 0
                i = 0
                while True:
                    try:
                        subkey_name = winreg.EnumKey(key, i)
                        monitor_count += 1
                        i += 1
                    except WindowsError:
                        break
                winreg.CloseKey(key)
                
                if monitor_count > 0:
                    self.config['monitors'] = monitor_count
                    logger.info(f"Detectados {monitor_count} monitor(s) via registry")
            except:
                # Fallback: usar WMI via subprocess
                try:
                    result = subprocess.run(['wmic', 'desktopmonitor', 'get', 'name'], 
                                          capture_output=True, text=True)
                    if result.returncode == 0:
                        lines = [line.strip() for line in result.stdout.split('\n') 
                                if line.strip() and 'Name' not in line and line.strip() != '']
                        self.config['monitors'] = len(lines)
                        logger.info(f"Detectados {len(lines)} monitor(s) via WMI")
                except Exception as e:
                    logger.warning(f"Erro ao detectar monitores: {e}")
                    self.config['monitors'] = 1
            
            # Detectar caminho do TightVNC
            possible_paths = [
                r"C:\Program Files\TightVNC\tvnserver.exe",
                r"C:\Program Files (x86)\TightVNC\tvnserver.exe",
                r"C:\Program Files\TightVNC\winvnc.exe",
                r"C:\Program Files (x86)\TightVNC\winvnc.exe"
            ]
            
            for path in possible_paths:
                if os.path.exists(path):
                    self.config['tightvnc_path'] = path
                    logger.info(f"TightVNC encontrado: {path}")
                    break
                    
        except Exception as e:
            logger.warning(f"Erro ao detectar informações do sistema: {e}")
    
    def setup_vnc_server(self):
        """Configura e inicia servidor VNC no Windows"""
        if not self.config.get('auto_start_vnc', True):
            return True
            
        try:
            return self.setup_vnc_windows()
        except Exception as e:
            logger.error(f"Erro ao configurar servidor VNC: {e}")
            return False
    
    def setup_vnc_windows(self):
        """Configurar TightVNC no Windows Server"""
        logger.info("Configurando TightVNC no Windows Server...")
        
        tightvnc_path = self.config.get('tightvnc_path')
        if not tightvnc_path or not os.path.exists(tightvnc_path):
            logger.error("TightVNC não encontrado. Instale o TightVNC Server.")
            return False
        
        try:
            # Parar serviço TightVNC se estiver rodando
            try:
                subprocess.run(['net', 'stop', 'tvnserver'], capture_output=True, check=False)
                time.sleep(2)
            except:
                pass
            
            # Configurar registry do TightVNC
            self.configure_tightvnc_registry()
            
            # Iniciar serviço TightVNC
            try:
                result = subprocess.run(['net', 'start', 'tvnserver'], 
                                      capture_output=True, text=True, check=True)
                logger.info("Serviço TightVNC iniciado com sucesso")
                return True
            except subprocess.CalledProcessError as e:
                logger.error(f"Erro ao iniciar serviço TightVNC: {e.stderr}")
                
                # Tentar iniciar manualmente
                try:
                    self.vnc_process = subprocess.Popen([
                        tightvnc_path, 
                        '-run'
                    ])
                    logger.info("TightVNC iniciado manualmente")
                    return True
                except Exception as e2:
                    logger.error(f"Erro ao iniciar TightVNC manualmente: {e2}")
                    return False
                    
        except Exception as e:
            logger.error(f"Erro ao configurar TightVNC: {e}")
            return False
    
    def configure_tightvnc_registry(self):
        """Configura registry do TightVNC"""
        try:
            # Chave principal do TightVNC
            key_path = r"SOFTWARE\TightVNC\Server"
            
            try:
                key = winreg.CreateKey(winreg.HKEY_LOCAL_MACHINE, key_path)
                
                # Configurações básicas
                winreg.SetValueEx(key, "RfbPort", 0, winreg.REG_DWORD, self.config['vnc_port'])
                winreg.SetValueEx(key, "HttpPort", 0, winreg.REG_DWORD, self.config.get('vnc_http_port', 5800))
                winreg.SetValueEx(key, "AcceptRfbConnections", 0, winreg.REG_DWORD, 1)
                winreg.SetValueEx(key, "AcceptHttpConnections", 0, winreg.REG_DWORD, 1)
                winreg.SetValueEx(key, "LogLevel", 0, winreg.REG_DWORD, 3)
                winreg.SetValueEx(key, "UseAuthentication", 0, winreg.REG_DWORD, 1 if self.config.get('vnc_password') else 0)
                
                # Configurar senha se fornecida
                if self.config.get('vnc_password'):
                    # TightVNC usa hash específico para senhas
                    password_hash = self.generate_vnc_password_hash(self.config['vnc_password'])
                    winreg.SetValueEx(key, "Password", 0, winreg.REG_BINARY, password_hash)
                
                winreg.CloseKey(key)
                logger.info("Configurações do TightVNC aplicadas no registry")
                
            except Exception as e:
                logger.error(f"Erro ao configurar registry: {e}")
                
        except Exception as e:
            logger.error(f"Erro ao acessar registry: {e}")
    
    def generate_vnc_password_hash(self, password):
        """Gera hash de senha compatível com TightVNC"""
        # Implementação simplificada - em produção, usar biblioteca específica
        # Por enquanto, retorna bytes da senha (TightVNC aceita texto simples em alguns casos)
        return password.encode('utf-8')[:8].ljust(8, b'\x00')
    
    def register_with_server(self):
        """Registra esta máquina com o servidor YuStream"""
        logger.info("Registrando com servidor YuStream...")
        
        registration_data = {
            "name": self.config['machine_name'],
            "host": self.get_public_ip(),
            "vncPort": self.config['vnc_port'],
            "monitors": self.config['monitors'],
            "authToken": self.config['register_token']
        }
        
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
            
            return self.get_local_ip()
            
        except Exception as e:
            logger.warning(f"Erro ao obter IP público: {e}")
            return self.get_local_ip()
    
    def get_local_ip(self):
        """Obtém IP local da máquina"""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            ip = s.getsockname()[0]
            s.close()
            return ip
        except:
            return "127.0.0.1"
    
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
        logger.info("Iniciando cliente VNC YuStream para Windows Server...")
        
        # Detectar informações do sistema
        self.detect_system_info()
        
        # Configurar servidor VNC
        if not self.setup_vnc_server():
            logger.error("Falha ao configurar servidor VNC")
            return False
        
        # Aguardar um pouco para o VNC inicializar
        time.sleep(3)
        
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
        logger.info(f"TightVNC: {self.config.get('tightvnc_path', 'Não encontrado')}")
        
        return True
    
    def stop(self):
        """Para o cliente VNC"""
        logger.info("Parando cliente VNC...")
        
        self.running = False
        
        if self.heartbeat_thread:
            self.heartbeat_thread.join(timeout=5)
        
        # Parar processo VNC se iniciado manualmente
        if self.vnc_process:
            try:
                self.vnc_process.terminate()
                self.vnc_process.wait(timeout=10)
            except:
                try:
                    self.vnc_process.kill()
                except:
                    pass
        
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
    parser = argparse.ArgumentParser(description='Cliente VNC para YuStream - Windows Server')
    parser.add_argument('--config', '-c', default='vnc-client.config.json',
                        help='Arquivo de configuração')
    parser.add_argument('--setup', action='store_true',
                        help='Executar configuração inicial')
    parser.add_argument('--install-service', action='store_true',
                        help='Instalar como serviço Windows')
    parser.add_argument('--remove-service', action='store_true',
                        help='Remover serviço Windows')
    parser.add_argument('--start-service', action='store_true',
                        help='Iniciar serviço Windows')
    parser.add_argument('--stop-service', action='store_true',
                        help='Parar serviço Windows')
    
    args = parser.parse_args()
    
    # Operações de serviço
    if args.install_service:
        try:
            win32serviceutil.InstallService(
                WindowsVNCService,
                WindowsVNCService._svc_name_,
                WindowsVNCService._svc_display_name_
            )
            print(f"Serviço {WindowsVNCService._svc_display_name_} instalado com sucesso")
        except Exception as e:
            print(f"Erro ao instalar serviço: {e}")
        return
    
    if args.remove_service:
        try:
            win32serviceutil.RemoveService(WindowsVNCService._svc_name_)
            print(f"Serviço {WindowsVNCService._svc_display_name_} removido com sucesso")
        except Exception as e:
            print(f"Erro ao remover serviço: {e}")
        return
    
    if args.start_service:
        try:
            win32serviceutil.StartService(WindowsVNCService._svc_name_)
            print(f"Serviço {WindowsVNCService._svc_display_name_} iniciado")
        except Exception as e:
            print(f"Erro ao iniciar serviço: {e}")
        return
    
    if args.stop_service:
        try:
            win32serviceutil.StopService(WindowsVNCService._svc_name_)
            print(f"Serviço {WindowsVNCService._svc_display_name_} parado")
        except Exception as e:
            print(f"Erro ao parar serviço: {e}")
        return
    
    # Configuração interativa
    if args.setup:
        client = VNCClient(args.config)
        print("=== Configuração do Cliente VNC YuStream - Windows Server ===")
        client.config['server_url'] = input(f"URL do servidor [{client.config['server_url']}]: ") or client.config['server_url']
        client.config['register_token'] = input(f"Token de registro [{client.config['register_token']}]: ") or client.config['register_token']
        client.config['machine_name'] = input(f"Nome da máquina [{client.config['machine_name']}]: ") or client.config['machine_name']
        client.config['vnc_port'] = int(input(f"Porta VNC [{client.config['vnc_port']}]: ") or client.config['vnc_port'])
        client.config['vnc_password'] = input(f"Senha VNC (deixe vazio para sem senha): ") or client.config['vnc_password']
        
        client.save_config()
        print(f"Configuração salva em {args.config}")
        return
    
    # Executar cliente
    client = VNCClient(args.config)
    
    # Verificar se está sendo executado como serviço
    if len(sys.argv) == 1:
        # Tentar executar como serviço
        try:
            win32serviceutil.HandleCommandLine(WindowsVNCService)
        except:
            # Se falhar, executar em modo interativo
            client.run_interactive()
    else:
        # Modo interativo
        client.run_interactive()

if __name__ == '__main__':
    main()
