const express = require("express");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { body, validationResult } = require("express-validator");
require("dotenv").config();

// Importar configuração do banco e modelos
const connectDB = require("./config/database");
const User = require("./models/User");
const PlayerConfig = require("./models/PlayerConfig");
const initUsers = require("./scripts/initUsers");

const app = express();
const router = express.Router();
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
router.post("/auth/login", authLimiter, loginValidation, async (req, res) => {
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
router.get("/auth/verify", authenticateToken, (req, res) => {
	res.json({
		valid: true,
		user: req.user,
	});
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

const extractVimeoEventId = (input = "") => {
	if (typeof input !== "string") {
		return null;
	}

	const trimmed = input.trim();
	if (!trimmed) {
		return null;
	}

	// Aceita ID numérico simples
	const directIdPattern = /^\d+$/;
	if (directIdPattern.test(trimmed)) return trimmed;

	// Aceita URLs típicas do Vimeo (evento ou vídeo)
	const urlPatterns = [
		/https?:\/\/vimeo\.com\/event\/(\d+)/i,
		/https?:\/\/player\.vimeo\.com\/video\/(\d+)/i,
		/https?:\/\/vimeo\.com\/video\/(\d+)/i,
		/https?:\/\/vimeo\.com\/(\d+)/i,
		/event\/(\d+)/i,
	];

	for (const pattern of urlPatterns) {
		const match = trimmed.match(pattern);
		if (match && match[1]) {
			return match[1];
		}
	}

	return null;
};

const toPlayerConfigResponse = (config) => {
	if (!config) {
		return { videoId: "" };
	}

	const plain =
		typeof config.toObject === "function" ? config.toObject() : { ...config };
	const updatedAtValue =
		plain.updatedAt instanceof Date
			? plain.updatedAt.toISOString()
			: typeof plain.updatedAt === "string"
			? plain.updatedAt
			: undefined;

	return {
		videoId: plain.videoId || "",
		updatedAt: updatedAtValue,
		updatedBy: plain.updatedBy || undefined,
	};
};

const updatePlayerConfigValidation = [
	body("videoId")
		.isString()
		.trim()
		.notEmpty()
		.withMessage("ID do evento do Vimeo é obrigatório"),
];

// ROTAS DE GERENCIAMENTO DE USUÁRIOS (apenas para admins)

// Listar todos os usuários
router.get("/admin/users", authenticateToken, requireAdmin, async (req, res) => {
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

router.get(
	"/admin/users/emails",
	authenticateToken,
	requireAdmin,
	async (req, res) => {
		try {
			const users = await User.find({
				email: { $exists: true, $ne: null },
			})
				.select("email -_id")
				.sort({ email: 1 })
				.lean();

			const uniqueEmails = Array.from(
				new Set(
					(users || [])
						.map((user) => user.email)
						.filter(
							(email) => typeof email === "string" && email.trim() !== ""
						)
				)
			);

			res.json({ emails: uniqueEmails });
		} catch (error) {
			console.error("Erro ao exportar emails:", error);
			res.status(500).json({ message: "Erro ao exportar emails dos usuários" });
		}
	}
);

// Buscar usuário por ID
router.get(
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
router.post(
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
router.put(
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
router.delete(
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
router.get("/admin/stats", authenticateToken, requireAdmin, async (req, res) => {
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

router.get("/player-config", async (req, res) => {
	try {
		const config = await PlayerConfig.findOne()
			.sort({ updatedAt: -1 })
			.lean();
		res.json(toPlayerConfigResponse(config));
	} catch (error) {
		console.error("Erro ao obter configuração do player:", error);
		res
			.status(500)
			.json({ message: "Não foi possível obter a configuração do player" });
	}
});

router.get(
	"/admin/player-config",
	authenticateToken,
	requireAdmin,
	async (req, res) => {
		try {
			const config = await PlayerConfig.findOne()
				.sort({ updatedAt: -1 })
				.lean();
			res.json(toPlayerConfigResponse(config));
		} catch (error) {
			console.error("Erro ao obter configuração do player (admin):", error);
			res
				.status(500)
				.json({ message: "Não foi possível obter a configuração do player" });
		}
	}
);

router.put(
	"/admin/player-config",
	authenticateToken,
	requireAdmin,
	updatePlayerConfigValidation,
	async (req, res) => {
		const errors = validationResult(req);
		if (!errors.isEmpty()) {
			return res.status(400).json({
				message: "Dados inválidos",
				errors: errors.array(),
			});
		}

		const parsedVideoId = extractVimeoEventId(req.body.videoId);
		if (!parsedVideoId) {
			return res.status(400).json({ message: "ID de evento do Vimeo inválido" });
		}

		try {
			const updatedConfig = await PlayerConfig.findOneAndUpdate(
				{},
				{
					videoId: parsedVideoId,
					updatedBy: req.user?.username || null,
				},
				{
					new: true,
					upsert: true,
					setDefaultsOnInsert: true,
				}
			);

			res.json(toPlayerConfigResponse(updatedConfig));
		} catch (error) {
			console.error("Erro ao atualizar configuração do player:", error);
			res
				.status(500)
				.json({ message: "Erro ao atualizar configuração do player" });
		}
	}
);

router.delete(
	"/admin/player-config",
	authenticateToken,
	requireAdmin,
	async (req, res) => {
		try {
			await PlayerConfig.deleteMany({});
			res.json(toPlayerConfigResponse(null));
		} catch (error) {
			console.error("Erro ao remover configuração do player:", error);
			res
				.status(500)
				.json({ message: "Erro ao remover configuração do player" });
		}
	}
);

// WEBHOOK ENDPOINTS PARA OVENMEDIAENGINE

// Endpoints do Stremio movidos para servidor dedicado (stremio-addon:7000)

// Rota de health check
router.get("/health", (req, res) => {
	res.json({ status: "OK", timestamp: new Date().toISOString() });
});

app.use("/api", router);
app.use("/", router);

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
