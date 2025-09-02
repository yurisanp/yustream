const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const { body, validationResult } = require('express-validator');
require('dotenv').config();

// Importar configuração do banco e modelos
const connectDB = require('./config/database');
const User = require('./models/User');
const initUsers = require('./scripts/initUsers');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'yustream-secret-key-change-in-production';
const STREAM_CHECK_URL = process.env.STREAM_CHECK_URL || 'http://ovenmediaengine:8080/live/live/abr.m3u8';

// Middleware de segurança
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // máximo 5 tentativas de login por IP
  message: JSON.stringify({ message: 'Muitas tentativas de login, tente novamente em 15 minutos' })
});

app.set('trust proxy', 1)

// Middleware de autenticação JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Token de acesso requerido' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ message: 'Token inválido ou expirado' });
    }
    req.user = user;
    next();
  });
};

// Validações para login
const loginValidation = [
  body('username').trim().notEmpty().withMessage('Username é obrigatório'),
  body('password').notEmpty().withMessage('Password é obrigatório')
];

// Rota de login
app.post('/auth/login', authLimiter, loginValidation, async (req, res) => {
  try {
    // Verificar erros de validação
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Dados inválidos',
        errors: errors.array() 
      });
    }

    const { username, password } = req.body;

    // Encontrar usuário no banco de dados
    const user = await User.findOne({ 
      username: username.toLowerCase(),
      isActive: true 
    });

    if (!user) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    // Verificar senha
    const validPassword = await user.comparePassword(password);
    if (!validPassword) {
      return res.status(401).json({ message: 'Credenciais inválidas' });
    }

    // Atualizar último login
    user.lastLogin = new Date();
    await user.save();

    // Gerar JWT token
    const token = jwt.sign(
      { 
        id: user._id, 
        username: user.username, 
        role: user.role 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login realizado com sucesso',
      token,
      user: user.toSafeObject()
    });

  } catch (error) {
    console.error('Erro no login:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Rota para verificar token
app.get('/auth/verify', authenticateToken, (req, res) => {
  res.json({
    valid: true,
    user: req.user
  });
});

// Rota para verificar status da stream
app.get('/stream/status', authenticateToken, async (req, res) => {
  try {
    // Verificar se a stream está online fazendo uma requisição para o manifest HLS
    const response = await axios.get(STREAM_CHECK_URL, {
      timeout: 5000,
      validateStatus: (status) => status < 500 // Aceitar códigos 2xx, 3xx e 4xx
    });

    const isOnline = response.status === 200 && response.data.includes('#EXTM3U');
    
    res.json({
      online: isOnline,
      status: isOnline ? 'online' : 'offline',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Erro ao verificar status da stream:', error.message);
    res.json({
      online: false,
      status: 'offline',
      error: 'Falha ao conectar com o servidor de stream',
      timestamp: new Date().toISOString()
    });
  }
});

// Rota para gerar token de acesso para stream (usado pelo Nginx)
app.get('/stream/token', authenticateToken, (req, res) => {
  // Gerar token temporário para acesso à stream (válido por 1 hora)
  const streamToken = jwt.sign(
    { 
      userId: req.user.id,
      username: req.user.username,
      streamAccess: true
    },
    JWT_SECRET,
    { expiresIn: '6h' }
  );

  res.json({
    streamToken,
    expiresIn: 3600 * 6 // 1 hora em segundos
  });
});

// Middleware para verificar se é admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Acesso negado. Apenas administradores.' });
  }
  next();
};

// Validações para criar usuário
const createUserValidation = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username deve ter entre 3 e 30 caracteres')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username deve conter apenas letras, números e underscore'),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Senha deve ter pelo menos 6 caracteres'),
  body('role')
    .optional()
    .isIn(['admin', 'user', 'moderator'])
    .withMessage('Role deve ser admin, user ou moderator')
];

// Validações para atualizar usuário
const updateUserValidation = [
  body('username')
    .optional()
    .trim()
    .isLength({ min: 3, max: 30 })
    .withMessage('Username deve ter entre 3 e 30 caracteres')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username deve conter apenas letras, números e underscore'),
  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Email inválido'),
  body('password')
    .optional()
    .isLength({ min: 6 })
    .withMessage('Senha deve ter pelo menos 6 caracteres'),
  body('role')
    .optional()
    .isIn(['admin', 'user', 'moderator'])
    .withMessage('Role deve ser admin, user ou moderator'),
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive deve ser true ou false')
];

// ROTAS DE GERENCIAMENTO DE USUÁRIOS (apenas para admins)

// Listar todos os usuários
app.get('/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await User.countDocuments();

    res.json({
      users,
      pagination: {
        current: page,
        total: Math.ceil(total / limit),
        count: users.length,
        totalUsers: total
      }
    });
  } catch (error) {
    console.error('Erro ao listar usuários:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Buscar usuário por ID
app.get('/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }
    res.json(user);
  } catch (error) {
    console.error('Erro ao buscar usuário:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Criar novo usuário
app.post('/admin/users', authenticateToken, requireAdmin, createUserValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Dados inválidos',
        errors: errors.array() 
      });
    }

    const { username, email, password, role = 'user' } = req.body;

    // Verificar se username ou email já existem
    const existingUser = await User.findOne({
      $or: [
        { username: username.toLowerCase() },
        { email: email.toLowerCase() }
      ]
    });

    if (existingUser) {
      return res.status(400).json({ 
        message: 'Username ou email já existem' 
      });
    }

    const user = new User({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password,
      role,
      createdBy: req.user.id
    });

    await user.save();
    
    res.status(201).json({
      message: 'Usuário criado com sucesso',
      user: user.toSafeObject()
    });
  } catch (error) {
    console.error('Erro ao criar usuário:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Atualizar usuário
app.put('/admin/users/:id', authenticateToken, requireAdmin, updateUserValidation, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        message: 'Dados inválidos',
        errors: errors.array() 
      });
    }

    const { username, email, password, role, isActive } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    // Verificar se não está tentando alterar seu próprio status de admin
    if (req.user.id === user._id.toString() && role && role !== 'admin') {
      return res.status(400).json({ 
        message: 'Você não pode alterar seu próprio role de admin' 
      });
    }

    // Atualizar campos
    if (username) user.username = username.toLowerCase();
    if (email) user.email = email.toLowerCase();
    if (password) user.password = password; // Será hasheada pelo middleware
    if (role) user.role = role;
    if (typeof isActive === 'boolean') user.isActive = isActive;

    await user.save();
    
    res.json({
      message: 'Usuário atualizado com sucesso',
      user: user.toSafeObject()
    });
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Deletar usuário
app.delete('/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    // Não permitir deletar a si mesmo
    if (req.user.id === user._id.toString()) {
      return res.status(400).json({ 
        message: 'Você não pode deletar sua própria conta' 
      });
    }

    await User.findByIdAndDelete(req.params.id);
    
    res.json({ message: 'Usuário deletado com sucesso' });
  } catch (error) {
    console.error('Erro ao deletar usuário:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Estatísticas de usuários
app.get('/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ isActive: true });
    const adminUsers = await User.countDocuments({ role: 'admin' });
    const regularUsers = await User.countDocuments({ role: 'user' });
    const moderatorUsers = await User.countDocuments({ role: 'moderator' });

    res.json({
      total: totalUsers,
      active: activeUsers,
      inactive: totalUsers - activeUsers,
      byRole: {
        admin: adminUsers,
        user: regularUsers,
        moderator: moderatorUsers
      }
    });
  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Webhook de admissão para OvenMediaEngine
app.post('/webhook/admission', (req, res) => {
  try {
    const { request } = req.body;
    
    if (!request) {
      console.log('❌ Request inválido no webhook');
      return res.status(400).json({ 
        allowed: false,
        new_url: request?.url,
        lifetime: 0 
      });
    }

    const { direction, protocol, url, stream, ip } = request;
    
    console.log(request);
    console.log(`📡 Webhook Request: ${direction} ${protocol} ${url}`);

    // Extrair token da URL
    let token = null;
    try {
      const urlObj = new URL(url, 'http://localhost');
      token = urlObj.searchParams.get('token');
    } catch (error) {
      console.log('❌ Erro ao parsear URL:', error.message);
    }

    // Para providers (RTMP de entrada), permitir sem token
    if (direction === 'incoming') {
      console.log('✅ Incoming stream (RTMP) - permitido sem token');
      return res.json({
        allowed: true,
        new_url: url,
        lifetime: 0 // 0 = sem limite de tempo
      });
    }

    // Para publishers (saída WebRTC/LLHLS), validar token
    if (direction === 'outgoing') {
      if (!token) {
        console.log('❌ Token requerido para stream de saída');
        return res.json({
          allowed: false,
          new_url: url,
          lifetime: 0
        });
      }

      // Validar token JWT
      jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
          console.log('❌ Token inválido:', err.message);
          return res.json({
            allowed: false,
            new_url: url,
            lifetime: 0
          });
        }

        if (!decoded.streamAccess) {
          console.log('❌ Token sem permissão de stream');
          return res.json({
            allowed: false,
            new_url: url,
            lifetime: 0
          });
        }

        console.log(`✅ Acesso permitido para usuário: ${decoded.username}`);
        
        return res.json({
          allowed: true,
          new_url: url,
          lifetime: 3600 * 6 // 1 hora em segundos
        });
      });
    } else {
      // Direção desconhecida - negar acesso
      console.log('❌ Direção desconhecida:', direction);
      return res.json({
        allowed: false,
        new_url: url,
        lifetime: 0
      });
    }

  } catch (error) {
    console.error('❌ Erro no webhook de admissão:', error);
    return res.status(500).json({
      allowed: false,
      new_url: req.body?.request?.url || '',
      lifetime: 0
    });
  }
});

// Webhook de fechamento de sessão
app.post('/webhook/close', (req, res) => {
  try {
    const { request } = req.body;
    const { direction, protocol, url, stream, ip } = request;
    
    console.log(`📡 Sessão fechada: ${direction} ${protocol} ${url}`);


    // Log da sessão fechada (aqui você pode implementar analytics)
    
    return res.json({ allowed: true });
  } catch (error) {
    console.error('❌ Erro no webhook de fechamento:', error);
    return res.status(500).json({ allowed: false });
  }
});

// STREMIO ADDON ENDPOINTS

// Manifest do addon Stremio
app.get('/stremio/manifest.json', (req, res) => {
  const manifest = {
    id: 'org.yustream.addon',
    version: '1.0.0',
    name: 'YuStream Live',
    description: 'Addon para assistir streams ao vivo do YuStream no Stremio',
    logo: 'https://via.placeholder.com/256x256/667eea/ffffff?text=YuStream',
    background: 'https://via.placeholder.com/1920x1080/667eea/ffffff?text=YuStream+Background',
    
    // Tipos de conteúdo suportados
    types: ['tv', 'movie'],
    
    // Recursos disponíveis
    resources: [
      'catalog',
      'stream'
    ],
    
    // Catálogos disponíveis
    catalogs: [
      {
        type: 'tv',
        id: 'yustream_live',
        name: 'YuStream Live',
        extra: [
          {
            name: 'email',
            isRequired: true,
            options: []
          },
          {
            name: 'password', 
            isRequired: true,
            options: []
          }
        ]
      }
    ],

    // Configurações do addon
    idPrefixes: ['yustream_'],
    behaviorHints: {
      adult: false,
      p2p: false,
      configurable: true,
      configurationRequired: true
    }
  };

  res.json(manifest);
});

// Catálogo de conteúdo para Stremio
app.get('/stremio/catalog/:type/:id/:extra?.json', async (req, res) => {
  try {
    const { type, id, extra } = req.params;
    
    // Decodificar parâmetros extras (email e senha)
    let email = null;
    let password = null;
    
    if (extra) {
      try {
        const extraParams = JSON.parse(Buffer.from(extra, 'base64').toString());
        email = extraParams.email;
        password = extraParams.password;
      } catch (error) {
        console.log('Erro ao decodificar parâmetros extras:', error.message);
      }
    }

    console.log(`📺 Stremio Catalog Request: ${type}/${id}`);
    console.log(`👤 Email: ${email ? 'presente' : 'ausente'}`);

    // Validar credenciais se fornecidas
    let isAuthenticated = false;
    if (email && password) {
      try {
        const user = await User.findOne({ 
          email: email.toLowerCase(),
          isActive: true 
        });

        if (user && await user.comparePassword(password)) {
          isAuthenticated = true;
          console.log(`✅ Usuário autenticado: ${user.username}`);
        }
      } catch (error) {
        console.log('❌ Erro na autenticação:', error.message);
      }
    }

    // Catálogo de streams disponíveis
    const metas = [];

    if (isAuthenticated) {
      // Stream principal sempre disponível para usuários autenticados
      metas.push({
        id: 'yustream_live_main',
        type: 'tv',
        name: 'YuStream Live',
        poster: 'https://via.placeholder.com/300x450/667eea/ffffff?text=LIVE',
        background: 'https://via.placeholder.com/1920x1080/667eea/ffffff?text=YuStream+Live',
        description: 'Stream ao vivo do YuStream - Transmissão em tempo real',
        genre: ['Live', 'Streaming'],
        releaseInfo: 'Ao Vivo',
        imdbRating: 9.5,
        director: ['YuStream'],
        cast: ['Transmissão Ao Vivo'],
        runtime: 'Contínuo',
        country: 'Brasil',
        language: 'Português',
        year: new Date().getFullYear(),
        videos: [
          {
            id: 'yustream_live_main_s1e1',
            title: 'Stream Ao Vivo',
            thumbnail: 'https://via.placeholder.com/320x180/667eea/ffffff?text=LIVE',
            overview: 'Transmissão ao vivo em alta qualidade'
          }
        ]
      });
    } else {
      // Mostrar item de configuração se não autenticado
      metas.push({
        id: 'yustream_config',
        type: 'tv',
        name: 'Configurar YuStream',
        poster: 'https://via.placeholder.com/300x450/ff6b6b/ffffff?text=CONFIG',
        description: 'Configure suas credenciais para acessar o YuStream',
        genre: ['Configuração'],
        releaseInfo: 'Configuração Necessária'
      });
    }

    res.json({ metas });

  } catch (error) {
    console.error('❌ Erro no catálogo Stremio:', error);
    res.status(500).json({ metas: [] });
  }
});

// Endpoint de stream para Stremio
app.get('/stremio/stream/:type/:id/:extra?.json', async (req, res) => {
  try {
    const { type, id, extra } = req.params;
    
    console.log(`🎬 Stremio Stream Request: ${type}/${id}`);

    // Decodificar parâmetros extras (email e senha)
    let email = null;
    let password = null;
    
    if (extra) {
      try {
        const extraParams = JSON.parse(Buffer.from(extra, 'base64').toString());
        email = extraParams.email;
        password = extraParams.password;
      } catch (error) {
        console.log('Erro ao decodificar parâmetros extras:', error.message);
      }
    }

    // Validar credenciais
    if (!email || !password) {
      return res.json({ 
        streams: [{
          title: '⚠️ Configuração Necessária',
          url: 'https://www.stremio.com/',
          description: 'Configure suas credenciais do YuStream nas configurações do addon'
        }]
      });
    }

    // Autenticar usuário
    const user = await User.findOne({ 
      email: email.toLowerCase(),
      isActive: true 
    });

    if (!user || !(await user.comparePassword(password))) {
      return res.json({ 
        streams: [{
          title: '❌ Credenciais Inválidas',
          url: 'https://www.stremio.com/',
          description: 'Email ou senha incorretos. Verifique suas credenciais.'
        }]
      });
    }

    console.log(`✅ Usuário autenticado para Stremio: ${user.username}`);

    // Gerar token de stream
    const streamToken = jwt.sign(
      { 
        userId: user._id,
        username: user.username,
        streamAccess: true,
        stremio: true
      },
      JWT_SECRET,
      { expiresIn: '6h' }
    );

    // Verificar se stream está online
    let streamOnline = false;
    try {
      const response = await axios.get(STREAM_CHECK_URL, {
        timeout: 5000,
        validateStatus: (status) => status < 500
      });
      streamOnline = response.status === 200 && response.data.includes('#EXTM3U');
    } catch (error) {
      console.log('Stream offline ou erro ao verificar:', error.message);
    }

    const streams = [];

    if (streamOnline) {
      // Stream principal em várias qualidades
      streams.push({
        title: '🔴 YuStream Live - Qualidade Adaptativa',
        url: `http://localhost/hls/live/abr.m3u8?token=${streamToken}`,
        description: 'Stream ao vivo em qualidade adaptativa (LLHLS)',
        behaviorHints: {
          notWebReady: false,
          bingeGroup: 'yustream-live'
        }
      });

      streams.push({
        title: '🎥 YuStream Live - Fonte Original',
        url: `http://localhost/hls/live/live.m3u8?token=${streamToken}`,
        description: 'Stream ao vivo na qualidade original',
        behaviorHints: {
          notWebReady: false,
          bingeGroup: 'yustream-live'
        }
      });
    } else {
      streams.push({
        title: '📴 Stream Offline',
        url: 'https://www.stremio.com/',
        description: 'A stream não está disponível no momento. Tente novamente mais tarde.'
      });
    }

    res.json({ streams });

  } catch (error) {
    console.error('❌ Erro no stream Stremio:', error);
    res.status(500).json({ 
      streams: [{
        title: '❌ Erro do Servidor',
        url: 'https://www.stremio.com/',
        description: 'Erro interno do servidor. Tente novamente mais tarde.'
      }]
    });
  }
});

// Endpoint de configuração do addon Stremio
app.get('/stremio/configure', (req, res) => {
  const configHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>YuStream Stremio Addon - Configuração</title>
    <meta charset="utf-8">
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 20px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container {
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px;
            max-width: 400px;
            width: 100%;
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.1);
        }
        h1 {
            text-align: center;
            color: #333;
            margin-bottom: 30px;
        }
        .form-group {
            margin-bottom: 20px;
        }
        label {
            display: block;
            margin-bottom: 8px;
            font-weight: 500;
            color: #555;
        }
        input {
            width: 100%;
            padding: 12px;
            border: 2px solid #e1e5e9;
            border-radius: 8px;
            font-size: 14px;
            box-sizing: border-box;
        }
        input:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }
        .install-btn {
            width: 100%;
            padding: 15px;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
        }
        .install-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(102, 126, 234, 0.3);
        }
        .info {
            margin-top: 20px;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }
        .info p {
            margin: 0;
            color: #666;
            font-size: 14px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🎬 YuStream Addon</h1>
        <form id="configForm">
            <div class="form-group">
                <label for="email">Email:</label>
                <input type="email" id="email" name="email" required placeholder="seu@email.com">
            </div>
            <div class="form-group">
                <label for="password">Senha:</label>
                <input type="password" id="password" name="password" required placeholder="Sua senha">
            </div>
            <button type="submit" class="install-btn">Instalar Addon no Stremio</button>
        </form>
        
        <div class="info">
            <p><strong>Como usar:</strong></p>
            <p>1. Digite suas credenciais do YuStream</p>
            <p>2. Clique em "Instalar Addon"</p>
            <p>3. O Stremio será aberto automaticamente</p>
            <p>4. Acesse a categoria "YuStream Live" para assistir</p>
        </div>
    </div>

    <script>
        document.getElementById('configForm').addEventListener('submit', function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            if (!email || !password) {
                alert('Por favor, preencha todos os campos');
                return;
            }
            
            // Codificar credenciais em base64
            const credentials = btoa(JSON.stringify({ email, password }));
            
            // URL do addon com credenciais
            const addonUrl = window.location.origin + '/stremio/' + credentials + '/manifest.json';
            
            // URL para instalar no Stremio
            const stremioUrl = 'stremio://' + encodeURIComponent(addonUrl);
            
            // Tentar abrir no Stremio
            window.location.href = stremioUrl;
            
            // Fallback para copiar URL
            setTimeout(() => {
                const fallbackUrl = 'https://web.stremio.com/#/addons?addon=' + encodeURIComponent(addonUrl);
                if (confirm('Se o Stremio não abriu automaticamente, clique OK para abrir no navegador:')) {
                    window.open(fallbackUrl, '_blank');
                }
            }, 2000);
        });
    </script>
</body>
</html>`;

  res.set('Content-Type', 'text/html');
  res.send(configHtml);
});

// Manifest com credenciais incorporadas
app.get('/stremio/:credentials/manifest.json', async (req, res) => {
  try {
    const { credentials } = req.params;
    
    // Decodificar credenciais
    let email, password;
    try {
      const decoded = JSON.parse(Buffer.from(credentials, 'base64').toString());
      email = decoded.email;
      password = decoded.password;
    } catch (error) {
      return res.status(400).json({ error: 'Credenciais inválidas' });
    }

    // Validar credenciais
    const user = await User.findOne({ 
      email: email.toLowerCase(),
      isActive: true 
    });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    console.log(`✅ Manifest Stremio para usuário: ${user.username}`);

    const manifest = {
      id: 'org.yustream.addon',
      version: '1.0.0',
      name: `YuStream Live - ${user.username}`,
      description: `Addon personalizado para ${user.username} assistir streams do YuStream`,
      logo: 'https://via.placeholder.com/256x256/667eea/ffffff?text=YuStream',
      background: 'https://via.placeholder.com/1920x1080/667eea/ffffff?text=YuStream+Live',
      
      types: ['tv'],
      resources: ['catalog', 'stream'],
      
      catalogs: [
        {
          type: 'tv',
          id: 'yustream_live',
          name: 'YuStream Live'
        }
      ],

      idPrefixes: ['yustream_'],
      behaviorHints: {
        adult: false,
        p2p: false,
        configurable: false
      }
    };

    res.json(manifest);

  } catch (error) {
    console.error('❌ Erro no manifest Stremio:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Catálogo com credenciais
app.get('/stremio/:credentials/catalog/:type/:id.json', async (req, res) => {
  try {
    const { credentials, type, id } = req.params;
    
    // Decodificar e validar credenciais
    let user;
    try {
      const decoded = JSON.parse(Buffer.from(credentials, 'base64').toString());
      user = await User.findOne({ 
        email: decoded.email.toLowerCase(),
        isActive: true 
      });
      
      if (!user || !(await user.comparePassword(decoded.password))) {
        throw new Error('Credenciais inválidas');
      }
    } catch (error) {
      return res.status(401).json({ metas: [] });
    }

    const metas = [{
      id: 'yustream_live_main',
      type: 'tv',
      name: 'YuStream Live',
      poster: 'https://via.placeholder.com/300x450/667eea/ffffff?text=LIVE',
      background: 'https://via.placeholder.com/1920x1080/667eea/ffffff?text=YuStream+Live',
      description: 'Stream ao vivo do YuStream em alta qualidade',
      genre: ['Live', 'Streaming'],
      releaseInfo: 'Ao Vivo',
      imdbRating: 9.5,
      runtime: 'Contínuo',
      year: new Date().getFullYear()
    }];

    res.json({ metas });

  } catch (error) {
    console.error('❌ Erro no catálogo Stremio:', error);
    res.status(500).json({ metas: [] });
  }
});

// Stream com credenciais
app.get('/stremio/:credentials/stream/:type/:id.json', async (req, res) => {
  try {
    const { credentials, type, id } = req.params;
    
    console.log(`🎬 Stremio Stream Request: ${type}/${id}`);

    // Decodificar e validar credenciais
    let user;
    try {
      const decoded = JSON.parse(Buffer.from(credentials, 'base64').toString());
      user = await User.findOne({ 
        email: decoded.email.toLowerCase(),
        isActive: true 
      });
      
      if (!user || !(await user.comparePassword(decoded.password))) {
        throw new Error('Credenciais inválidas');
      }
    } catch (error) {
      return res.status(401).json({ streams: [] });
    }

    // Gerar token de stream
    const streamToken = jwt.sign(
      { 
        userId: user._id,
        username: user.username,
        streamAccess: true,
        stremio: true
      },
      JWT_SECRET,
      { expiresIn: '6h' }
    );

    // Verificar se stream está online
    let streamOnline = false;
    try {
      const response = await axios.get(STREAM_CHECK_URL, {
        timeout: 5000,
        validateStatus: (status) => status < 500
      });
      streamOnline = response.status === 200 && response.data.includes('#EXTM3U');
    } catch (error) {
      console.log('Stream offline:', error.message);
    }

    const streams = [];

    if (streamOnline && id === 'yustream_live_main') {
      const hostname = req.get('host') || 'localhost';
      
      streams.push({
        title: '🔴 YuStream Live - Qualidade Adaptativa',
        url: `http://${hostname}/hls/live/abr.m3u8?token=${streamToken}`,
        description: 'Stream ao vivo em qualidade adaptativa (LLHLS)',
        behaviorHints: {
          notWebReady: false,
          bingeGroup: 'yustream-live'
        }
      });

      console.log(`✅ Stream fornecida para Stremio: ${user.username}`);
    } else {
      streams.push({
        title: '📴 Stream Offline',
        url: 'https://www.stremio.com/',
        description: 'A stream não está disponível no momento. Tente novamente mais tarde.'
      });
    }

    res.json({ streams });

  } catch (error) {
    console.error('❌ Erro no stream Stremio:', error);
    res.status(500).json({ streams: [] });
  }
});

// Rota de health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Middleware de erro global
app.use((err, req, res, next) => {
  console.error('Erro:', err);
  res.status(500).json({ message: 'Erro interno do servidor' });
});

// Inicializar banco de dados e servidor
const startServer = async () => {
  try {
    // Conectar ao MongoDB
    await connectDB();
    
    // Inicializar usuários padrão se não existirem (sem conectar novamente)
    await initUsers(false);
    
    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`🚀 Servidor de autenticação rodando na porta ${PORT}`);
      console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Erro ao iniciar servidor:', error);
    process.exit(1);
  }
};

startServer();
