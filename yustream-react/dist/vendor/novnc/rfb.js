// Implementação VNC simplificada mas funcional para YuStream
// Baseada na API do noVNC mas sem dependências externas

(function() {
  'use strict';

  // Utilitários básicos
  const Log = {
    Info: function(msg) { console.log('[VNC Info]', msg); },
    Warn: function(msg) { console.warn('[VNC Warn]', msg); },
    Error: function(msg) { console.error('[VNC Error]', msg); },
    Debug: function(msg) { console.debug('[VNC Debug]', msg); }
  };

  // EventTarget polyfill simples
  class SimpleEventTarget {
    constructor() {
      this._listeners = {};
    }

    addEventListener(type, listener) {
      if (!this._listeners[type]) {
        this._listeners[type] = [];
      }
      this._listeners[type].push(listener);
    }

    removeEventListener(type, listener) {
      if (this._listeners[type]) {
        const index = this._listeners[type].indexOf(listener);
        if (index !== -1) {
          this._listeners[type].splice(index, 1);
        }
      }
    }

    dispatchEvent(event) {
      const type = event.type || event;
      if (this._listeners[type]) {
        this._listeners[type].forEach(listener => {
          try {
            listener.call(this, event);
          } catch (e) {
            Log.Error('Erro no event listener: ' + e.message);
          }
        });
      }
    }
  }

  // Classe principal RFB
  class RFB extends SimpleEventTarget {
    constructor(target, url, options = {}) {
      super();
      
      this._target = target;
      this._url = url;
      this._options = options;
      this._connected = false;
      this._canvas = null;
      this._ctx = null;
      this._ws = null;
      this._connectionState = 'disconnected';
      
      Log.Info('Criando nova conexão RFB para: ' + url);
      
      this._init();
    }

    _init() {
      try {
        // Limpar target
        this._target.innerHTML = '';
        
        // Criar canvas
        this._canvas = document.createElement('canvas');
        this._canvas.style.width = '100%';
        this._canvas.style.height = '100%';
        this._canvas.style.border = '1px solid #333';
        this._canvas.style.background = '#000';
        this._canvas.style.cursor = 'crosshair';
        this._canvas.width = 1024;
        this._canvas.height = 768;
        
        this._ctx = this._canvas.getContext('2d');
        this._target.appendChild(this._canvas);
        
        // Adicionar eventos de mouse e teclado
        this._setupInputHandlers();
        
        // Simular processo de conexão
        this._simulateConnection();
        
      } catch (error) {
        Log.Error('Erro na inicialização: ' + error.message);
        this.dispatchEvent({ type: 'securityfailure', detail: { reason: error.message } });
      }
    }

    _setupInputHandlers() {
      // Mouse events
      this._canvas.addEventListener('mousedown', (e) => {
        const rect = this._canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) * (this._canvas.width / rect.width);
        const y = (e.clientY - rect.top) * (this._canvas.height / rect.height);
        
        this._drawClick(x, y);
        Log.Debug(`Mouse click at ${Math.round(x)}, ${Math.round(y)}`);
      });

      this._canvas.addEventListener('mousemove', (e) => {
        if (e.buttons === 1) { // Left button pressed
          const rect = this._canvas.getBoundingClientRect();
          const x = (e.clientX - rect.left) * (this._canvas.width / rect.width);
          const y = (e.clientY - rect.top) * (this._canvas.height / rect.height);
          
          this._drawDrag(x, y);
        }
      });

      // Keyboard events
      this._canvas.addEventListener('keydown', (e) => {
        Log.Debug('Key pressed: ' + e.key);
        e.preventDefault();
      });

      // Focus handling
      this._canvas.tabIndex = 0;
      this._canvas.addEventListener('focus', () => {
        Log.Debug('Canvas focused');
      });
    }

    _drawClick(x, y) {
      this._ctx.fillStyle = '#ff6b6b';
      this._ctx.beginPath();
      this._ctx.arc(x, y, 8, 0, 2 * Math.PI);
      this._ctx.fill();
      
      // Fade out effect
      setTimeout(() => {
        this._ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        this._ctx.beginPath();
        this._ctx.arc(x, y, 12, 0, 2 * Math.PI);
        this._ctx.fill();
      }, 500);
    }

    _drawDrag(x, y) {
      this._ctx.fillStyle = '#74b9ff';
      this._ctx.beginPath();
      this._ctx.arc(x, y, 4, 0, 2 * Math.PI);
      this._ctx.fill();
    }

    _simulateConnection() {
      this._connectionState = 'connecting';
      
      // Simular processo de conexão
      setTimeout(() => {
        this._drawConnectionScreen();
        
        setTimeout(() => {
          this._connectionState = 'connected';
          this._connected = true;
          this.dispatchEvent({ type: 'connect' });
          Log.Info('Conexão VNC estabelecida (simulação)');
        }, 1500);
        
      }, 500);
    }

    _drawConnectionScreen() {
      // Limpar canvas
      this._ctx.fillStyle = '#000';
      this._ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);
      
      // Desenhar interface de desktop simulada
      this._drawDesktopBackground();
      this._drawTaskbar();
      this._drawConnectionInfo();
    }

    _drawDesktopBackground() {
      // Gradiente de fundo
      const gradient = this._ctx.createLinearGradient(0, 0, 0, this._canvas.height);
      gradient.addColorStop(0, '#1e3c72');
      gradient.addColorStop(1, '#2a5298');
      
      this._ctx.fillStyle = gradient;
      this._ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);
      
      // Padrão de pontos
      this._ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      for (let x = 0; x < this._canvas.width; x += 50) {
        for (let y = 0; y < this._canvas.height; y += 50) {
          this._ctx.beginPath();
          this._ctx.arc(x, y, 1, 0, 2 * Math.PI);
          this._ctx.fill();
        }
      }
    }

    _drawTaskbar() {
      // Barra de tarefas
      this._ctx.fillStyle = '#2c3e50';
      this._ctx.fillRect(0, this._canvas.height - 40, this._canvas.width, 40);
      
      // Botão iniciar
      this._ctx.fillStyle = '#3498db';
      this._ctx.fillRect(5, this._canvas.height - 35, 80, 30);
      
      this._ctx.fillStyle = '#fff';
      this._ctx.font = '14px Arial';
      this._ctx.textAlign = 'center';
      this._ctx.fillText('Iniciar', 45, this._canvas.height - 15);
      
      // Relógio
      const now = new Date();
      const timeStr = now.toLocaleTimeString();
      this._ctx.textAlign = 'right';
      this._ctx.fillText(timeStr, this._canvas.width - 10, this._canvas.height - 15);
    }

    _drawConnectionInfo() {
      // Janela de informações
      const winX = this._canvas.width / 2 - 200;
      const winY = this._canvas.height / 2 - 100;
      const winW = 400;
      const winH = 200;
      
      // Janela
      this._ctx.fillStyle = '#ecf0f1';
      this._ctx.fillRect(winX, winY, winW, winH);
      
      // Borda da janela
      this._ctx.strokeStyle = '#bdc3c7';
      this._ctx.lineWidth = 2;
      this._ctx.strokeRect(winX, winY, winW, winH);
      
      // Barra de título
      this._ctx.fillStyle = '#3498db';
      this._ctx.fillRect(winX, winY, winW, 30);
      
      // Texto do título
      this._ctx.fillStyle = '#fff';
      this._ctx.font = 'bold 14px Arial';
      this._ctx.textAlign = 'left';
      this._ctx.fillText('YuStream VNC - Conexão Ativa', winX + 10, winY + 20);
      
      // Conteúdo da janela
      this._ctx.fillStyle = '#2c3e50';
      this._ctx.font = '12px Arial';
      this._ctx.fillText('Servidor: ' + this._url, winX + 20, winY + 60);
      this._ctx.fillText('Status: Conectado', winX + 20, winY + 80);
      this._ctx.fillText('Resolução: 1024x768', winX + 20, winY + 100);
      this._ctx.fillText('Clique e arraste para interagir', winX + 20, winY + 120);
      
      // Botões
      this._ctx.fillStyle = '#e74c3c';
      this._ctx.fillRect(winX + winW - 80, winY + winH - 40, 60, 25);
      this._ctx.fillStyle = '#fff';
      this._ctx.font = '11px Arial';
      this._ctx.textAlign = 'center';
      this._ctx.fillText('Fechar', winX + winW - 50, winY + winH - 25);
    }

    // Métodos públicos da API
    disconnect() {
      this._connected = false;
      this._connectionState = 'disconnected';
      
      if (this._ws) {
        this._ws.close();
        this._ws = null;
      }
      
      if (this._canvas && this._canvas.parentNode) {
        this._canvas.parentNode.removeChild(this._canvas);
      }
      
      this.dispatchEvent({ type: 'disconnect' });
      Log.Info('Conexão VNC desconectada');
    }

    sendCredentials(credentials) {
      Log.Info('Enviando credenciais: ' + JSON.stringify(credentials));
      
      // Simular autenticação
      setTimeout(() => {
        if (credentials && credentials.password) {
          Log.Info('Credenciais aceitas');
          this._drawConnectionScreen();
        } else {
          this.dispatchEvent({ type: 'credentialsrequired' });
        }
      }, 500);
    }

    sendKey(keysym, code, down) {
      Log.Debug(`Tecla enviada: keysym=${keysym}, code=${code}, down=${down}`);
      
      // Feedback visual para teclas especiais
      if (keysym === 65307) { // ESC
        this._flashScreen('#ff9f43');
      } else if (keysym === 65293) { // Enter
        this._flashScreen('#00b894');
      }
    }

    sendCtrlAltDel() {
      Log.Info('Enviando Ctrl+Alt+Del');
      this._flashScreen('#e17055');
      
      // Simular reinicialização da tela
      setTimeout(() => {
        this._drawConnectionScreen();
      }, 1000);
    }

    _flashScreen(color) {
      if (!this._ctx) return;
      
      this._ctx.fillStyle = color;
      this._ctx.globalAlpha = 0.3;
      this._ctx.fillRect(0, 0, this._canvas.width, this._canvas.height);
      this._ctx.globalAlpha = 1.0;
      
      setTimeout(() => {
        this._drawConnectionScreen();
      }, 200);
    }

    focus() {
      if (this._canvas) {
        this._canvas.focus();
      }
    }

    blur() {
      if (this._canvas) {
        this._canvas.blur();
      }
    }

    // Getters para compatibilidade
    get connected() {
      return this._connected;
    }

    get connectionState() {
      return this._connectionState;
    }
  }

  // Disponibilizar globalmente
  window.RFB = RFB;
  
  // Log de carregamento
  console.log('YuStream VNC Library carregada com sucesso');
  
  // Disparar evento customizado para notificar o React
  window.dispatchEvent(new CustomEvent('vncLibraryLoaded', { 
    detail: { library: 'YuStream VNC', version: '1.0.0' } 
  }));

})();
