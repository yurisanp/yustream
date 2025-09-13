const express = require("express");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const axios = require("axios");
const { body, validationResult } = require("express-validator");
require("dotenv").config();

// Importar configuração do banco e modelos
const connectDB = require("./config/database");
const User = require("./models/User");
const initUsers = require("./scripts/initUsers");

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET =
	process.env.JWT_SECRET || "yustream-secret-key-change-in-production";

// Middleware de segurança
app.use(
	helmet({
		contentSecurityPolicy: {
			directives: {
				defaultSrc: ["'self'"],
				scriptSrc: ["'self'", "'unsafe-inline'"], // Permitir scripts inline
				styleSrc: ["'self'", "'unsafe-inline'"], // Permitir estilos inline
				imgSrc: ["'self'", "data:", "https:"], // Permitir imagens externas
				connectSrc: ["'self'", "https:"], // Permitir conexões externas
			},
		},
	})
);
app.use(
	cors({
		origin: process.env.CORS_ORIGIN || "*",
		credentials: true,
	})
);
app.use(express.json({ limit: "10mb" }));

const authLimiter = rateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutos
	max: 5, // máximo 5 tentativas de login por IP
	message: JSON.stringify({
		message: "Muitas tentativas de login, tente novamente em 15 minutos",
	}),
});

app.set("trust proxy", 1);

// Middleware de autenticação JWT
const authenticateToken = (req, res, next) => {
	const authHeader = req.headers["authorization"];
	const token = authHeader && authHeader.split(" ")[1];

	if (!token) {
		return res.status(401).json({ message: "Token de acesso requerido" });
	}

	jwt.verify(token, JWT_SECRET, (err, user) => {
		if (err) {
			return res.status(403).json({ message: "Token inválido ou expirado" });
		}
		req.user = user;
		next();
	});
};

// Validações para login
const loginValidation = [
	body("username").trim().notEmpty().withMessage("Username é obrigatório"),
	body("password").notEmpty().withMessage("Password é obrigatório"),
];

// Rota de login
app.post("/auth/login", authLimiter, loginValidation, async (req, res) => {
	try {
		// Verificar erros de validação
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				message: "Dados inválidos",
				errors: errors.array(),
			});
		}

		const { username, password } = req.body;

		// Encontrar usuário no banco de dados
		const user = await User.findOne({
			username: username.toLowerCase(),
			isActive: true,
		});

		if (!user) {
			return res.status(401).json({ message: "Credenciais inválidas" });
		}

		// Verificar senha
		const validPassword = await user.comparePassword(password);
		if (!validPassword) {
			return res.status(401).json({ message: "Credenciais inválidas" });
		}

		// Atualizar último login
		user.lastLogin = new Date();
		await user.save();

		// Gerar JWT token
		const token = jwt.sign(
			{
				id: user._id,
				username: user.username,
				role: user.role,
			},
			JWT_SECRET,
			{ expiresIn: "24h" }
		);

		res.json({
			message: "Login realizado com sucesso",
			token,
			user: user.toSafeObject(),
		});
	} catch (error) {
		console.error("Erro no login:", error);
		res.status(500).json({ message: "Erro interno do servidor" });
	}
});

// Rota para verificar token
app.get("/auth/verify", authenticateToken, (req, res) => {
	res.json({
		valid: true,
		user: req.user,
	});
});

// Rota para verificar status da stream usando API REST do OvenMediaEngine
app.get("/stream/status", authenticateToken, async (req, res) => {
	const hostname = process.env.OME_HOSTNAME || "ovenmediaengine";
	const omeApiPort = process.env.OME_API_PORT || "8081";
	const vhostName = process.env.OME_VHOST || "default";
	const appName = process.env.OME_APP || "live";
	const streamName = process.env.OME_STREAM || "live";
	try {
		// URL da API REST do OvenMediaEngine para verificar streams ativas
		const omeApiUrl = `http://${hostname}:${omeApiPort}/v1/vhosts/${vhostName}/apps/${appName}/multiplexChannels/${streamName}`;

		console.log(`🔍 Verificando status da stream via API OME: ${omeApiUrl}`);

		// Fazer requisição para a API REST do OvenMediaEngine com autenticação
		const omeAccessToken = process.env.OME_ACCESS_TOKEN || "maketears";
		const authHeader = Buffer.from(omeAccessToken).toString("base64");

		const response = await axios.get(omeApiUrl, {
			timeout: 5000,
			headers: {
				Accept: "application/json",
				Authorization: `Basic ${authHeader}`,
			},
		});

		if (
			response.status === 200 &&
			response.data &&
			response.data.response &&
			response.data.response.state &&
			response.data.response.state === "Playing"
		) {
			console.log(JSON.stringify(response.data, null, 4));
			res.json({
				online: true,
				status: "online",
				streamName: streamName,
				hasWebRTC: false,
				hasLLHLS: true,
				totalActiveStreams: 1,
				streamDetails: response.data.response || null,
				timestamp: new Date().toISOString(),
			});
		} else {
			res.json({
				online: false,
				status: "offline",
				streamName: streamName,
				hasWebRTC: false,
				hasLLHLS: false,
				totalActiveStreams: 0,
				streamDetails: null,
				timestamp: new Date().toISOString(),
			});
		}
	} catch (error) {
		if (error.status && error.status === 404) {
			res.json({
				online: false,
				status: "offline",
				streamName: streamName,
				hasWebRTC: false,
				hasLLHLS: false,
				totalActiveStreams: 0,
				streamDetails: null,
				timestamp: new Date().toISOString(),
			});
			return;
		}
		console.error(
			"❌ Erro ao verificar status da stream via API OME:",
			error.message
		);

		res.json({
			online: false,
			status: "offline",
			error: "Falha ao conectar com o servidor de stream",
			timestamp: new Date().toISOString(),
		});
	}
});

// Rota para gerar token de acesso para stream
app.get("/stream/token", authenticateToken, (req, res) => {
	// Gerar token temporário para acesso à stream (válido por 6 horas)
	const streamToken = jwt.sign(
		{
			userId: req.user.id,
			username: req.user.username,
			streamAccess: true,
		},
		JWT_SECRET,
		{ expiresIn: "6h" }
	);

	res.json({
		streamToken,
		expiresIn: 3600 * 6, // 6 horas em segundos
	});
});

// Rota para listar qualidades disponíveis
app.get("/stream/qualities", authenticateToken, async (req, res) => {
	try {
		const config = getOMEConfig();
		const vhostName = config.vhostName;
		const appName = config.appName;
		
		// Definir as qualidades baseadas no VHost.xml
		const availableQualities = [
			{
				name: "Fonte",
				application: "fonte",
				streamName: "fonte",
				displayName: "Fonte Original",
				description: "Qualidade original da fonte",
				priority: 1,
				url: `stream://${vhostName}/${appName}/fonte`
			},
			{
				name: "1440p",
				application: "1440",
				streamName: "1440",
				displayName: "1440p Ultra HD",
				description: "Qualidade Ultra HD 1440p",
				priority: 2,
				url: `stream://${vhostName}/${appName}/1440`
			},
			{
				name: "1080p",
				application: "1080",
				streamName: "1080",
				displayName: "1080p Full HD",
				description: "Qualidade Full HD 1080p",
				priority: 3,
				url: `stream://${vhostName}/${appName}/1080`
			},
			{
				name: "720p",
				application: "720",
				streamName: "720",
				displayName: "720p HD",
				description: "Qualidade HD 720p",
				priority: 4,
				url: `stream://${vhostName}/${appName}/720`
			},
			{
				name: "360p",
				application: "360",
				streamName: "360",
				displayName: "360p SD",
				description: "Qualidade SD 360p",
				priority: 5,
				url: `stream://${vhostName}/${appName}/360`
			}
		];

		// Verificar quais qualidades estão ativas
		const activeQualities = [];
		
		for (const quality of availableQualities) {
			try {
				// Verificar se a stream está ativa na aplicação específica
				const streamUrl = `/v1/vhosts/${vhostName}/apps/${quality.application}/streams/${quality.streamName}`;
				const response = await makeOMERequest(streamUrl);
				
				if (response.response && response.response.state === "Playing") {
					activeQualities.push({
						...quality,
						active: true,
						state: response.response.state,
						uptime: response.response.uptime || 0,
						totalConnections: response.response.totalConnections || 0
					});
				} else {
					activeQualities.push({
						...quality,
						active: false,
						state: response.response?.state || "Stopped"
					});
				}
			} catch (error) {
				// Se não conseguir acessar a stream, considerá-la inativa
				activeQualities.push({
					...quality,
					active: false,
					state: "Not Found",
					error: error.message
				});
			}
		}

		// Ordenar por prioridade (menor número = maior prioridade)
		activeQualities.sort((a, b) => a.priority - b.priority);

		res.json({
			qualities: activeQualities,
			abr: {
				active: false,
				url: null,
				description: "Stream adaptativa com múltiplas qualidades"
			},
			timestamp: new Date().toISOString(),
			totalQualities: availableQualities.length,
			activeQualities: activeQualities.filter(q => q.active).length
		});

	} catch (error) {
		console.error('Erro ao listar qualidades:', error);
		res.status(500).json({ 
			message: 'Erro ao obter qualidades disponíveis',
			error: error.message 
		});
	}
});

// Middleware para verificar se é admin
const requireAdmin = (req, res, next) => {
	if (req.user.role !== "admin") {
		return res
			.status(403)
			.json({ message: "Acesso negado. Apenas administradores." });
	}
	next();
};

// Validações para criar usuário
const createUserValidation = [
	body("username")
		.trim()
		.isLength({ min: 3, max: 30 })
		.withMessage("Username deve ter entre 3 e 30 caracteres")
		.matches(/^[a-zA-Z0-9_]+$/)
		.withMessage("Username deve conter apenas letras, números e underscore"),
	body("email").isEmail().normalizeEmail().withMessage("Email inválido"),
	body("password")
		.isLength({ min: 6 })
		.withMessage("Senha deve ter pelo menos 6 caracteres"),
	body("role")
		.optional()
		.isIn(["admin", "user", "moderator"])
		.withMessage("Role deve ser admin, user ou moderator"),
];

// Validações para atualizar usuário
const updateUserValidation = [
	body("username")
		.optional()
		.trim()
		.isLength({ min: 3, max: 30 })
		.withMessage("Username deve ter entre 3 e 30 caracteres")
		.matches(/^[a-zA-Z0-9_]+$/)
		.withMessage("Username deve conter apenas letras, números e underscore"),
	body("email")
		.optional()
		.isEmail()
		.normalizeEmail()
		.withMessage("Email inválido"),
	body("password")
		.optional()
		.isLength({ min: 6 })
		.withMessage("Senha deve ter pelo menos 6 caracteres"),
	body("role")
		.optional()
		.isIn(["admin", "user", "moderator"])
		.withMessage("Role deve ser admin, user ou moderator"),
	body("isActive")
		.optional()
		.isBoolean()
		.withMessage("isActive deve ser true ou false"),
];

// ROTAS DE GERENCIAMENTO DE USUÁRIOS (apenas para admins)

// Listar todos os usuários
app.get("/admin/users", authenticateToken, requireAdmin, async (req, res) => {
	try {
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const skip = (page - 1) * limit;

		const users = await User.find()
			.select("-password")
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
				totalUsers: total,
			},
		});
	} catch (error) {
		console.error("Erro ao listar usuários:", error);
		res.status(500).json({ message: "Erro interno do servidor" });
	}
});

// Buscar usuário por ID
app.get(
	"/admin/users/:id",
	authenticateToken,
	requireAdmin,
	async (req, res) => {
		try {
			const user = await User.findById(req.params.id).select("-password");
			if (!user) {
				return res.status(404).json({ message: "Usuário não encontrado" });
			}
			res.json(user);
		} catch (error) {
			console.error("Erro ao buscar usuário:", error);
			res.status(500).json({ message: "Erro interno do servidor" });
		}
	}
);

// Criar novo usuário
app.post(
	"/admin/users",
	authenticateToken,
	requireAdmin,
	createUserValidation,
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({
					message: "Dados inválidos",
					errors: errors.array(),
				});
			}

			const { username, email, password, role = "user" } = req.body;

			// Verificar se username ou email já existem
			const existingUser = await User.findOne({
				$or: [
					{ username: username.toLowerCase() },
					{ email: email.toLowerCase() },
				],
			});

			if (existingUser) {
				return res.status(400).json({
					message: "Username ou email já existem",
				});
			}

			const user = new User({
				username: username.toLowerCase(),
				email: email.toLowerCase(),
				password,
				role,
				createdBy: req.user.id,
			});

			await user.save();

			res.status(201).json({
				message: "Usuário criado com sucesso",
				user: user.toSafeObject(),
			});
		} catch (error) {
			console.error("Erro ao criar usuário:", error);
			res.status(500).json({ message: "Erro interno do servidor" });
		}
	}
);

// Atualizar usuário
app.put(
	"/admin/users/:id",
	authenticateToken,
	requireAdmin,
	updateUserValidation,
	async (req, res) => {
		try {
			const errors = validationResult(req);
			if (!errors.isEmpty()) {
				return res.status(400).json({
					message: "Dados inválidos",
					errors: errors.array(),
				});
			}

			const { username, email, password, role, isActive } = req.body;
			const user = await User.findById(req.params.id);

			if (!user) {
				return res.status(404).json({ message: "Usuário não encontrado" });
			}

			// Verificar se não está tentando alterar seu próprio status de admin
			if (req.user.id === user._id.toString() && role && role !== "admin") {
				return res.status(400).json({
					message: "Você não pode alterar seu próprio role de admin",
				});
			}

			// Atualizar campos
			if (username) user.username = username.toLowerCase();
			if (email) user.email = email.toLowerCase();
			if (password) user.password = password; // Será hasheada pelo middleware
			if (role) user.role = role;
			if (typeof isActive === "boolean") user.isActive = isActive;

			await user.save();

			res.json({
				message: "Usuário atualizado com sucesso",
				user: user.toSafeObject(),
			});
		} catch (error) {
			console.error("Erro ao atualizar usuário:", error);
			res.status(500).json({ message: "Erro interno do servidor" });
		}
	}
);

// Deletar usuário
app.delete(
	"/admin/users/:id",
	authenticateToken,
	requireAdmin,
	async (req, res) => {
		try {
			const user = await User.findById(req.params.id);

			if (!user) {
				return res.status(404).json({ message: "Usuário não encontrado" });
			}

			// Não permitir deletar a si mesmo
			if (req.user.id === user._id.toString()) {
				return res.status(400).json({
					message: "Você não pode deletar sua própria conta",
				});
			}

			await User.findByIdAndDelete(req.params.id);

			res.json({ message: "Usuário deletado com sucesso" });
		} catch (error) {
			console.error("Erro ao deletar usuário:", error);
			res.status(500).json({ message: "Erro interno do servidor" });
		}
	}
);

// Estatísticas de usuários
app.get("/admin/stats", authenticateToken, requireAdmin, async (req, res) => {
	try {
		const totalUsers = await User.countDocuments();
		const activeUsers = await User.countDocuments({ isActive: true });
		const adminUsers = await User.countDocuments({ role: "admin" });
		const regularUsers = await User.countDocuments({ role: "user" });
		const moderatorUsers = await User.countDocuments({ role: "moderator" });

		res.json({
			total: totalUsers,
			active: activeUsers,
			inactive: totalUsers - activeUsers,
			byRole: {
				admin: adminUsers,
				user: regularUsers,
				moderator: moderatorUsers,
			},
		});
	} catch (error) {
		console.error("Erro ao obter estatísticas:", error);
		res.status(500).json({ message: "Erro interno do servidor" });
	}
});

// ROTAS DE CONTROLE ABR VIA OVENMEDIAENGINE API

// Configurações do OvenMediaEngine
const getOMEConfig = () => ({
	hostname: process.env.OME_HOSTNAME || "ovenmediaengine",
	apiPort: process.env.OME_API_PORT || "8081",
	vhostName: process.env.OME_VHOST || "default",
	appName: process.env.OME_APP || "live",
	accessToken: process.env.OME_ACCESS_TOKEN || "maketears"
});

// Helper para fazer requisições para OME
const makeOMERequest = async (endpoint, method = 'GET', data = null) => {
	const config = getOMEConfig();
	const authHeader = Buffer.from(config.accessToken).toString('base64');
	
	const url = `http://${config.hostname}:${config.apiPort}${endpoint}`;
	
	const options = {
		method,
		headers: {
			'Accept': 'application/json',
			'Content-Type': 'application/json',
			'Authorization': `Basic ${authHeader}`,
		},
		timeout: 10000
	};
	
	if (data) {
		options.data = data;
	}
	
	try {
		const response = await axios(url, options);
		return response.data;
	} catch (error) {
		console.error(`Erro na requisição OME ${method} ${endpoint}:`, error.message);
		throw error;
	}
};

// GET /api/abr/config - Obter configuração atual do ABR
app.get("/abr/config", authenticateToken, requireAdmin, async (req, res) => {
	try {
		const config = getOMEConfig();
		const channelName = "live"; // Nome do canal multiplex
		
		// Tentar obter informações do canal multiplex
		try {
			const channelInfo = await makeOMERequest(
				`/v1/vhosts/${config.vhostName}/apps/${config.appName}/multiplexChannels/${channelName}`
			);
			
			// Converter resposta do OME para formato do frontend
			const qualities = [
				{ name: 'Fonte', enabled: false, videoTrack: 'fonte_video', audioTrack: 'fonte_audio', url: 'stream://default/fonte/fonte' },
				{ name: '1440', enabled: false, videoTrack: '1440_video', audioTrack: '1440_audio', url: 'stream://default/1440/1440' },
				{ name: '1080', enabled: false, videoTrack: '1080_video', audioTrack: '1080_audio', url: 'stream://default/1080/1080' },
				{ name: '720', enabled: false, videoTrack: '720_video', audioTrack: '720_audio', url: 'stream://default/720/720' },
				{ name: '360', enabled: false, videoTrack: '360_video', audioTrack: '360_audio', url: 'stream://default/360/360' }
			];
			
			// Verificar quais qualidades estão ativas baseado nos sourceStreams
			if (channelInfo.response && channelInfo.response.sourceStreams) {
				channelInfo.response.sourceStreams.forEach(stream => {
					const qualityName = stream.name.charAt(0).toUpperCase() + stream.name.slice(1);
					const quality = qualities.find(q => q.name === qualityName);
					if (quality) {
						quality.enabled = true;
					}
				});
			}
			
			const abrConfig = {
				qualities,
				playlistName: channelInfo.response?.playlists?.[0]?.name || 'LLHLS ABR',
				fileName: channelInfo.response?.playlists?.[0]?.fileName || 'abr'
			};
			
			res.json(abrConfig);
		} catch (error) {
			// Se canal não existe, retornar configuração padrão
			if (error.response?.status === 404) {
				const defaultConfig = {
					qualities: [
						{ name: 'Fonte', enabled: true, videoTrack: 'fonte_video', audioTrack: 'fonte_audio', url: 'stream://default/fonte/fonte' },
						{ name: '1440', enabled: false, videoTrack: '1440_video', audioTrack: '1440_audio', url: 'stream://default/1440/1440' },
						{ name: '1080', enabled: false, videoTrack: '1080_video', audioTrack: '1080_audio', url: 'stream://default/1080/1080' },
						{ name: '720', enabled: true, videoTrack: '720_video', audioTrack: '720_audio', url: 'stream://default/720/720' },
						{ name: '360', enabled: false, videoTrack: '360_video', audioTrack: '360_audio', url: 'stream://default/360/360' }
					],
					playlistName: 'LLHLS ABR',
					fileName: 'abr'
				};
				res.json(defaultConfig);
			} else {
				throw error;
			}
		}
	} catch (error) {
		console.error('Erro ao carregar configuração ABR:', error);
		res.status(500).json({ message: 'Erro ao carregar configuração ABR' });
	}
});

// PUT /api/abr/config - Atualizar configuração completa do ABR
app.put("/abr/config", authenticateToken, requireAdmin, async (req, res) => {
	try {
		const { qualities, playlistName, fileName } = req.body;
		const config = getOMEConfig();
		const channelName = "live";
		
		// Converter para formato OME
		const enabledQualities = qualities.filter(q => q.enabled);
		
		const omeConfig = {
			outputStream: {
				name: channelName
			},
			sourceStreams: enabledQualities.map(quality => ({
				name: quality.name.toLowerCase(),
				url: quality.url,
				trackMap: [
					{
						sourceTrackName: "bypass_video",
						newTrackName: quality.videoTrack,
					},
					{
						sourceTrackName: "bypass_audio",
						newTrackName: quality.audioTrack,
					}
				]
			})),
			playlists: [
				{
					name: playlistName,
					fileName: fileName,
					options: {
						webrtcAutoAbr: true,
						hlsChunklistPathDepth: 0,
						enableTsPackaging: true
					},
					renditions: enabledQualities.map(quality => ({
						name: quality.name,
						video: quality.videoTrack,
						audio: quality.audioTrack
					}))
				}
			]
		};
		
		// Primeiro tentar deletar canal existente se houver
		try {
			await makeOMERequest(
				`/v1/vhosts/${config.vhostName}/apps/${config.appName}/multiplexChannels/${channelName}`,
				'DELETE'
			);
		} catch (error) {
			// Ignorar erro se canal não existir
		}
		
		// Criar novo canal
		await makeOMERequest(
			`/v1/vhosts/${config.vhostName}/apps/${config.appName}/multiplexChannels`,
			'POST',
			omeConfig
		);
		
		res.json({ message: 'Configuração ABR atualizada com sucesso' });
	} catch (error) {
		console.error('Erro ao atualizar configuração ABR:', error);
		res.status(500).json({ message: 'Erro ao atualizar configuração ABR' });
	}
});

// PATCH /api/abr/quality/:qualityName - Ativar/desativar uma qualidade específica
app.patch("/abr/quality/:qualityName", authenticateToken, requireAdmin, async (req, res) => {
	try {
		const { qualityName } = req.params;
		const { enabled } = req.body;
		const config = getOMEConfig();
		const channelName = "live";
		
		// Obter configuração atual
		let currentConfig;
		try {
			const channelInfo = await makeOMERequest(
				`/v1/vhosts/${config.vhostName}/apps/${config.appName}/multiplexChannels/${channelName}`
			);
			currentConfig = channelInfo.response;
		} catch (error) {
			// Se canal não existe, usar configuração padrão
			currentConfig = {
				playlists: [{ name: 'LLHLS ABR', fileName: 'abr' }],
				sourceStreams: []
			};
		}
		
		// Atualizar configuração
		const qualities = [
			{ name: 'Fonte', enabled: false, videoTrack: 'fonte_video', audioTrack: 'fonte_audio', url: 'stream://default/fonte/fonte' },
			{ name: '1440', enabled: false, videoTrack: '1440_video', audioTrack: '1440_audio', url: 'stream://default/1440/1440' },
			{ name: '1080', enabled: false, videoTrack: '1080_video', audioTrack: '1080_audio', url: 'stream://default/1080/1080' },
			{ name: '720', enabled: false, videoTrack: '720_video', audioTrack: '720_audio', url: 'stream://default/720/720' },
			{ name: '360', enabled: false, videoTrack: '360_video', audioTrack: '360_audio', url: 'stream://default/360/360' }
		];
		
		// Mapear qualidades ativas atuais
		if (currentConfig.sourceStreams) {
			currentConfig.sourceStreams.forEach(stream => {
				const qualityName = stream.name.charAt(0).toUpperCase() + stream.name.slice(1);
				const quality = qualities.find(q => q.name === qualityName);
				if (quality) {
					quality.enabled = true;
				}
			});
		}
		
		// Atualizar qualidade específica
		const targetQuality = qualities.find(q => q.name === qualityName);
		if (targetQuality) {
			targetQuality.enabled = enabled;
		}
		
		// Recriar canal com nova configuração
		const enabledQualities = qualities.filter(q => q.enabled);
		
		const omeConfig = {
			outputStream: {
				name: channelName
			},
			sourceStreams: enabledQualities.map(quality => ({
				name: quality.name.toLowerCase(),
				url: quality.url,
				trackMap: [
					{
						sourceTrackName: "bypass_video",
						newTrackName: quality.videoTrack,
					},
					{
						sourceTrackName: "bypass_audio",
						newTrackName: quality.audioTrack,
					}
				]
			})),
			playlists: [
				{
					name: currentConfig.playlists?.[0]?.name || 'LLHLS ABR',
					fileName: currentConfig.playlists?.[0]?.fileName || 'abr',
					options: {
						webrtcAutoAbr: true,
						hlsChunklistPathDepth: 0,
						enableTsPackaging: true
					},
					renditions: enabledQualities.map(quality => ({
						name: quality.name,
						video: quality.videoTrack,
						audio: quality.audioTrack
					}))
				}
			]
		};
		
		// Deletar canal existente
		try {
			await makeOMERequest(
				`/v1/vhosts/${config.vhostName}/apps/${config.appName}/multiplexChannels/${channelName}`,
				'DELETE'
			);
		} catch (error) {
			// Ignorar erro se canal não existir
		}
		
		// Criar novo canal
		await makeOMERequest(
			`/v1/vhosts/${config.vhostName}/apps/${config.appName}/multiplexChannels`,
			'POST',
			omeConfig
		);
		
		res.json({ message: `Qualidade ${qualityName} ${enabled ? 'ativada' : 'desativada'} com sucesso` });
	} catch (error) {
		console.error('Erro ao alterar qualidade:', error);
		res.status(500).json({ message: 'Erro ao alterar qualidade' });
	}
});

// WEBHOOK ENDPOINTS PARA OVENMEDIAENGINE

// Webhook de admissão para OvenMediaEngine
app.post("/webhook/admission", (req, res) => {
	try {
		const { request } = req.body;

		if (!request) {
			console.log("❌ Request inválido no webhook");
			return res.status(400).json({
				allowed: false,
				new_url: request?.url,
				lifetime: 0,
			});
		}

		const { direction, protocol, url, stream, ip } = request;

		console.log(request);
		console.log(`📡 Webhook Request: ${direction} ${protocol} ${url}`);

		// Extrair token da URL
		let token = null;
		try {
			const urlObj = new URL(url, "http://localhost");
			token = urlObj.searchParams.get("token");
		} catch (error) {
			console.log("❌ Erro ao parsear URL:", error.message);
		}

		// Para providers (RTMP de entrada), permitir sem token
		if (direction === "incoming") {
			console.log("✅ Incoming stream (RTMP) - permitido sem token");
			return res.json({
				allowed: true,
				new_url: url,
				lifetime: 0, // 0 = sem limite de tempo
			});
		}

		// Para publishers (saída WebRTC/LLHLS), validar token
		if (direction === "outgoing") {
			if (!token) {
				console.log("❌ Token requerido para stream de saída");
				return res.json({
					allowed: false,
					new_url: url,
					lifetime: 0,
				});
			}

			// Validar token JWT
			jwt.verify(token, JWT_SECRET, (err, decoded) => {
				if (err) {
					console.log("❌ Token inválido:", err.message);
					return res.json({
						allowed: false,
						new_url: url,
						lifetime: 0,
					});
				}

				if (!decoded.streamAccess) {
					console.log("❌ Token sem permissão de stream");
					return res.json({
						allowed: false,
						new_url: url,
						lifetime: 0,
					});
				}

				console.log(`✅ Acesso permitido para usuário: ${decoded.username}`);

				return res.json({
					allowed: true,
					new_url: url,
					lifetime: 3600000 * 6, // 6 horas em segundos
				});
			});
		} else {
			// Direção desconhecida - negar acesso
			console.log("❌ Direção desconhecida:", direction);
			return res.json({
				allowed: false,
				new_url: url,
				lifetime: 0,
			});
		}
	} catch (error) {
		console.error("❌ Erro no webhook de admissão:", error);
		return res.status(500).json({
			allowed: false,
			new_url: req.body?.request?.url || "",
			lifetime: 0,
		});
	}
});

// Webhook de fechamento de sessão
app.post("/webhook/close", (req, res) => {
	try {
		const { request } = req.body;
		const { direction, protocol, url, stream, ip } = request;

		console.log(`📡 Sessão fechada: ${direction} ${protocol} ${url}`);

		// Log da sessão fechada (aqui você pode implementar analytics)

		return res.json({ allowed: true });
	} catch (error) {
		console.error("❌ Erro no webhook de fechamento:", error);
		return res.status(500).json({ allowed: false });
	}
});

// Endpoints do Stremio movidos para servidor dedicado (stremio-addon:7000)

// Rota de health check
app.get("/health", (req, res) => {
	res.json({ status: "OK", timestamp: new Date().toISOString() });
});

// Middleware de erro global
app.use((err, req, res, next) => {
	console.error("Erro:", err);
	res.status(500).json({ message: "Erro interno do servidor" });
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
			console.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
		});
	} catch (error) {
		console.error("❌ Erro ao iniciar servidor:", error);
		process.exit(1);
	}
};

startServer();
