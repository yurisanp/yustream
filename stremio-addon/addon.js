const {
	addonBuilder,
	serveHTTP,
	publishToCentral,
} = require("stremio-addon-sdk");
const axios = require("axios");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
require("dotenv").config();

// Configurações
const JWT_SECRET =
	process.env.JWT_SECRET || "yustream-jwt-secret-change-in-production-2024";
const STREAM_CHECK_URL =
	process.env.STREAM_CHECK_URL ||
	"http://ovenmediaengine:8080/live/live/abr.m3u8";
const MONGODB_URI =
	process.env.MONGODB_URI ||
	"mongodb://yustream:yustream123@mongodb:27017/yustream?authSource=admin";
const PORT = process.env.STREMIO_PORT || 7000;

// Conectar ao MongoDB
mongoose
	.connect(MONGODB_URI)
	.then(() => console.log("🗄️ MongoDB conectado para Stremio addon"))
	.catch((err) => console.error("❌ Erro ao conectar MongoDB:", err));

// Modelo de usuário (mesmo schema do auth server)
const userSchema = new mongoose.Schema(
	{
		username: { type: String, required: true, unique: true },
		email: { type: String, required: true, unique: true },
		password: { type: String, required: true },
		role: {
			type: String,
			enum: ["admin", "user", "moderator"],
			default: "user",
		},
		isActive: { type: Boolean, default: true },
		lastLogin: { type: Date, default: null },
	},
	{ timestamps: true }
);

userSchema.methods.comparePassword = async function (candidatePassword) {
	return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", userSchema);

// Configuração do addon
const builder = new addonBuilder({
	id: "org.yustream.live",
	version: "1.0.0",
	name: "YuStream Live",
	description: "Assista streams ao vivo do YuStream diretamente no Stremio",
	logo: "https://yustream.yurisp.com.br/stremio-assets/logo.svg",
	background:
		"https://yustream.yurisp.com.br/stremio-assets/background.svg",

	// Tipos de conteúdo suportados
	types: ["tv"],

	// Recursos disponíveis
	resources: ["catalog", "stream"],

	// Catálogos
	catalogs: [
		{
			type: "tv",
			id: "yustream_live",
			name: "YuStream Live",
		},
	],

	// Prefixos de ID
	idPrefixes: ["yustream_"],

	config: [
		{ key: "username", type: "text", title: "Username", required: true },
		{ key: "password", type: "password", title: "Senha", required: true },
	],

	// Comportamentos
	behaviorHints: {
		adult: false,
		p2p: false,
		configurable: true,
		configurationRequired: true,
	},
});

// Middleware para extrair credenciais da URL
const extractCredentialsFromRequest = (req) => {
	if (req && req.url) {
		const path = req.url;
		console.log("Full request path:", path);

		// Tentar extrair credenciais da URL path (formato: /{encoded_json}/...)
		const match = path.match(/^\/([^\/]+)\/(?:manifest\.json|catalog|stream)/);
		if (match) {
			try {
				const encodedCreds = match[1];
				console.log("Encoded credentials from path:", encodedCreds);

				// Decodificar URL encoding e depois JSON
				const decodedCreds = decodeURIComponent(encodedCreds);
				console.log("Decoded credentials:", decodedCreds);

				const credentials = JSON.parse(decodedCreds);
				console.log("Parsed credentials:", credentials);

				// Suporte para compatibilidade com email (migração)
				if (credentials.email && !credentials.username) {
					console.log("Migrando de email para username...");
					// Se tem email mas não tem username, usar email como username
					credentials.username = credentials.email.split('@')[0];
				}

				return credentials;
			} catch (error) {
				console.log("Erro ao extrair credenciais da URL:", error.message);
			}
		}
	}
	return null;
};

// Handler do catálogo
builder.defineCatalogHandler(async (args, callback, req) => {
	console.log("📺 Catalog request:", args);

	try {
		const { config } = args;

		// Tentar extrair credenciais da URL primeiro, depois dos parâmetros extras
		let username, password;

		// Primeiro tentar extrair da URL
		const urlCredentials = extractCredentialsFromRequest(req);
		if (urlCredentials) {
			username = urlCredentials.username;
			password = urlCredentials.password;
			console.log("Using URL credentials");
		} else {
			username = config && config.username;
			password = config && config.password;
			console.log("Using config parameters");
		}

		console.log(`👤 Username: ${username ? "presente" : "ausente"}`);

		// Validar credenciais se fornecidas
		let isAuthenticated = false;
		let user = null;

		if (username && password) {
			try {
				user = await User.findOne({
					username: username.toLowerCase(),
					isActive: true,
				});

				if (user && (await user.comparePassword(password))) {
					isAuthenticated = true;
					console.log(`✅ Usuário autenticado: ${user.username}`);

					// Atualizar último login
					user.lastLogin = new Date();
					await user.save();
				} else {
					console.log("❌ Credenciais inválidas");
				}
			} catch (error) {
				console.log("❌ Erro na autenticação:", error.message);
			}
		}

		let metas = [];

		if (isAuthenticated) {
			// Gerar token para verificação da stream
			const streamToken = jwt.sign(
				{
					userId: user._id,
					username: user.username,
					streamAccess: true,
					stremio: true,
				},
				JWT_SECRET,
				{ expiresIn: "6h" }
			);

			// Verificar se stream está online com token
			let streamOnline = false;
			try {
				const streamCheckUrl = `${STREAM_CHECK_URL}?token=${streamToken}`;
				console.log("Checking stream with token:", streamCheckUrl);
				
				const response = await axios.get(streamCheckUrl, {
					timeout: 5000,
					validateStatus: (status) => status < 500,
				});
				streamOnline =
					response.status === 200 && response.data.includes("#EXTM3U");
				console.log("Stream status:", streamOnline ? "ONLINE" : "OFFLINE");
			} catch (error) {
				console.log("Stream offline:", error.message);
			}
			// Stream principal
			metas.push({
				id: "yustream_live_main",
				type: "tv",
				name: streamOnline ? "🔴 YuStream Live" : "📴 YuStream Live (Offline)",
				poster: streamOnline
					? "https://yustream.yurisp.com.br/stremio-assets/poster-live.svg"
					: "https://yustream.yurisp.com.br/stremio-assets/poster-offline.svg",
				background:
					"https://yustream.yurisp.com.br/stremio-assets/background.svg",
				description: streamOnline
					? "Stream ao vivo do YuStream - Transmissão em tempo real"
					: "Stream do YuStream está offline no momento",
				genre: ["Live", "Streaming"],
				releaseInfo: streamOnline ? "Ao Vivo" : "Offline",
				imdbRating: streamOnline ? 9.5 : 0,
				director: ["YuStream"],
				cast: ["Transmissão Ao Vivo"],
				runtime: streamOnline ? "Contínuo" : "N/A",
				country: "Brasil",
				language: "Português",
				year: new Date().getFullYear(),
			});
		} else {
			// Mostrar item de configuração se não autenticado
			metas.push({
				id: "yustream_config",
				type: "tv",
				name: "⚙️ Configurar YuStream",
				poster: "https://yustream.yurisp.com.br/stremio-assets/poster-config.svg",
				background:
					"https://yustream.yurisp.com.br/stremio-assets/background.svg",
				description:
					"Configure suas credenciais para acessar o YuStream. Use email e senha nos parâmetros do addon.",
				genre: ["Configuração"],
				releaseInfo: "Configuração Necessária",
				year: new Date().getFullYear(),
			});
		}

		return Promise.resolve({ metas });
	} catch (error) {
		console.error("❌ Erro no catálogo:", error);
		return Promise.resolve({ metas: [] });
	}
});

// Handler de stream
builder.defineStreamHandler(async (args, callback, req) => {
	console.log("🎬 Stream request:", args);

	try {
		const { type, id, config } = args;

		// Tentar extrair credenciais da URL primeiro, depois dos parâmetros extras
		let username, password;

		// Primeiro tentar extrair da URL
		const urlCredentials = extractCredentialsFromRequest(req);
		if (urlCredentials) {
			username = urlCredentials.username;
			password = urlCredentials.password;
			console.log("Using URL credentials for stream");
		} else {
			username = config && config.username;
			password = config && config.password;
			console.log("Using config parameters for stream");
		}

		console.log(`🎬 Stream Request: ${type}/${id}`);
		console.log(`👤 Username: ${username ? "presente" : "ausente"}`);

		// Validar credenciais
		if (!username || !password) {
			return Promise.resolve({
				streams: [
					{
						title: "⚠️ Configuração Necessária",
						url: "https://www.stremio.com/",
						description:
							"Configure suas credenciais do YuStream nos parâmetros do addon",
					},
				],
			});
		}

		// Autenticar usuário
		let user;
		try {
			user = await User.findOne({
				username: username.toLowerCase(),
				isActive: true,
			});

			if (!user || !(await user.comparePassword(password))) {
				return Promise.resolve({
					streams: [
						{
							title: "❌ Credenciais Inválidas",
							url: "https://www.stremio.com/",
							description:
								"Username ou senha incorretos. Verifique suas credenciais.",
						},
					],
				});
			}
		} catch (error) {
			console.error("❌ Erro na autenticação:", error);
			return Promise.resolve({ streams: [] });
		}

		console.log(`✅ Usuário autenticado para stream: ${user.username}`);

		// Gerar token de stream
		const streamToken = jwt.sign(
			{
				userId: user._id,
				username: user.username,
				streamAccess: true,
				stremio: true,
			},
			JWT_SECRET,
			{ expiresIn: "6h" }
		);

		// Verificar se stream está online com token
		let streamOnline = false;
		try {
			const streamCheckUrl = `${STREAM_CHECK_URL}?token=${streamToken}`;
			console.log("Checking stream with token:", streamCheckUrl);
			
			const response = await axios.get(streamCheckUrl, {
				timeout: 5000,
				validateStatus: (status) => status < 500,
			});
			streamOnline =
				response.status === 200 && response.data.includes("#EXTM3U");
			console.log("Stream status:", streamOnline ? "ONLINE" : "OFFLINE");
		} catch (error) {
			console.log("Stream offline:", error.message);
		}

		const streams = [];
		if (streamOnline && id === "yustream_live_main") {
			// Usar localhost pois será acessado via Nginx
			const baseUrl = "https://yustream.yurisp.com.br";

			streams.push({
				title: "🔴 YuStream Live - Qualidade Adaptativa",
				url: `${baseUrl}:8080/live/live/abr.m3u8?token=${streamToken}`,
				description: "Stream ao vivo em qualidade adaptativa (LLHLS)",
				behaviorHints: {
					notWebReady: false,
					bingeGroup: "yustream-live",
					countryWhitelist: ["BR", "US", "CA"], // Países permitidos
				},
				subtitles: [], // Sem legendas por enquanto
			});
		} else if (!streamOnline) {
			streams.push({
				title: "📴 Stream Offline",
				url: "https://www.stremio.com/",
				description:
					"A stream não está disponível no momento. Tente novamente mais tarde.",
				behaviorHints: {
					notWebReady: true,
				},
			});
		} else {
			streams.push({
				title: "❓ Conteúdo Não Encontrado",
				url: "https://www.stremio.com/",
				description: "O conteúdo solicitado não foi encontrado.",
			});
		}

		return Promise.resolve({ streams });
	} catch (error) {
		console.error("❌ Erro no stream handler:", error);
		return Promise.resolve({
			streams: [
				{
					title: "❌ Erro do Servidor",
					url: "https://www.stremio.com/",
					description: "Erro interno do servidor. Tente novamente mais tarde.",
				},
			],
		});
	}
});

console.log("🎬 YuStream Stremio Addon iniciando...");
console.log("📡 Conectando ao MongoDB...");

// Iniciar servidor
serveHTTP(builder.getInterface(), {
	port: PORT,
})
	.then(() => {
		console.log(`🚀 YuStream Stremio Addon rodando na porta ${PORT}`);
		console.log(`📋 Manifest: http://localhost:${PORT}/manifest.json`);
		console.log(`🎨 Assets: https://yustream.yurisp.com.br/stremio-assets/`);
		console.log("🎯 Pronto para uso no Stremio!");
	})
	.catch((err) => {
		console.error("❌ Erro ao iniciar addon:", err);
	});
