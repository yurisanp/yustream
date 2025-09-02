import { useState, useEffect, useRef, useCallback } from "react";
import { Wifi, WifiOff, AlertCircle, LogOut, Settings, Play } from "lucide-react";
import OvenPlayer from "ovenplayer";
import Hls from "hls.js";
import { useAuth } from "../contexts/AuthContext";
import AdminScreen from "./AdminScreen";
import StremioConfig from "./StremioConfig";
import "./OvenStreamPlayer.css";

interface OvenStreamPlayerProps {
	showToast: (message: string, type: "success" | "error" | "info") => void;
}

// Interface básica para o OvenPlayer
interface OvenPlayerInstance {
	destroy?: () => void;
	remove?: () => void;
	on?: (event: string, callback: (data?: unknown) => void) => void;
	play?: () => void;
	pause?: () => void;
	setMute?: (muted: boolean) => void;
	setVolume?: (volume: number) => void;
	getSources?: () => Array<{ type?: string; label?: string; index: number }>;
	setCurrentSource?: (index: number) => void;
}

type StreamStatus =
	| "connecting"
	| "playing"
	| "paused"
	| "error"
	| "offline"
	| "idle";

const STREAM_ID = "live";

const OvenStreamPlayer = ({ showToast }: OvenStreamPlayerProps) => {
	const { user, logout, getStreamToken } = useAuth();

	// Estados principais
	const [status, setStatus] = useState<StreamStatus>("connecting");
	const [showAdminScreen, setShowAdminScreen] = useState<boolean>(false);
	const [showStremioConfig, setShowStremioConfig] = useState<boolean>(false);
	const [retryCount, setRetryCount] = useState<number>(0);
	const [lastInitTime, setLastInitTime] = useState<number>(0);

	// Refs
	const playerContainerRef = useRef<HTMLDivElement>(null);
	const ovenPlayerRef = useRef<OvenPlayerInstance | null>(null);
	const showToastRef = useRef(showToast);

	// Atualizar ref sempre que showToast mudar
	useEffect(() => {
		showToastRef.current = showToast;
	}, [showToast]);

	// Constantes para retry
	const MAX_RETRY_ATTEMPTS = 3;
	const MIN_RETRY_INTERVAL = 10000; // 10 segundos mínimo entre tentativas

	// Configurações do OvenPlayer para OvenMediaEngine
	const getPlayerConfig = useCallback((streamTokenPr: string | null) => {
		const hostname = window.location.hostname;
		const isSecure = window.location.protocol === 'https:';
		const wsProtocol = isSecure ? 'wss:' : 'ws:';
		const httpProtocol = isSecure ? 'https:' : 'http:';
		const wsPort = isSecure ? '3334' : '3333';
		const httpPort = isSecure ? '8443' : '8080';
		const tokenParam = streamTokenPr ? `?token=${streamTokenPr}` : "";
		
		return {
			autoStart: true,
			autoFallback: true,
			controls: true, // Usar controles nativos do OvenPlayer
			loop: false,
			muted: false,
			volume: 100,
			playbackRate: 1,
			playsinline: true,
			sources: [
				{
					label: "WebRTC",
					type: "webrtc" as const,
					file: `${wsProtocol}//${hostname}:${wsPort}/live/${STREAM_ID}/abr_webrtc${tokenParam}`,
					lowLatency: true,
				},
				{
					label: "LLHLS",
					type: "llhls" as const,
					file: `${httpProtocol}//${hostname}:${httpPort}/live/${STREAM_ID}/abr.m3u8${tokenParam}`,
					lowLatency: true,
				},
			],
			webrtcConfig: {
				iceServers: [
					{ urls: "stun:stun.l.google.com:19302" },
					{ urls: "stun:stun1.l.google.com:19302" },
				],
			},
			hlsConfig: {
				lowLatencyMode: true,
				backBufferLength: 90,
			},
		};
	}, []);

	// Função simples para retry com controle de tempo
	const scheduleRetry = useCallback(() => {
		const now = Date.now();

		// Verificar se já passou tempo suficiente desde a última tentativa
		if (now - lastInitTime < MIN_RETRY_INTERVAL) {
			console.log("Retry muito rápido, ignorando...");
			return;
		}

		// Verificar se ainda pode tentar
		if (retryCount >= MAX_RETRY_ATTEMPTS) {
			setStatus("offline");
			showToastRef.current(
				'Stream offline. Use "Tentar Novamente" para reconectar.',
				"info"
			);
			return;
		}

		setRetryCount((prev) => prev + 1);
		setLastInitTime(now);

		showToastRef.current(
			`Tentando reconectar... (${retryCount + 1}/${MAX_RETRY_ATTEMPTS})`,
			"info"
		);

		setTimeout(() => {
			initializePlayer();
		}, 5000); // 5 segundos de delay
	}, [retryCount, MAX_RETRY_ATTEMPTS, lastInitTime, MIN_RETRY_INTERVAL]);

	const initializePlayer = useCallback(async () => {
		if (!playerContainerRef.current) return;

		try {
			setStatus("connecting");

			// Obter token de stream
			const token = await getStreamToken();
			if (!token) {
				setStatus("error");
				showToastRef.current("Erro ao obter token de acesso à stream", "error");
				return;
			}
			// Criar novo OvenPlayer
			ovenPlayerRef.current = OvenPlayer.create(
				"ovenPlayer",
				getPlayerConfig(token)
			);

			if (!ovenPlayerRef.current) {
				throw new Error("Falha ao criar instância do OvenPlayer");
			}

			// Event listeners do OvenPlayer
			const player = ovenPlayerRef.current;

			player.on?.("ready", () => {
				console.log("OvenPlayer pronto");
				setStatus("playing");
			});

			player.on?.("stateChanged", (data: unknown) => {
				const stateData = data as { prevstate: string; newstate: string };
				console.log("Estado mudou:", stateData);

				switch (stateData.newstate) {
					case "playing":
						setStatus("playing");
						break;
					case "paused":
						setStatus("paused");
						break;
					case "loading":
						setStatus("connecting");
						break;
					case "error":
						setStatus("error");
						showToastRef.current("Erro na reprodução", "error");
						break;
				}
			});

			player.on?.("error", (error: unknown) => {
				const errorData = error as { message?: string; code?: number };
				console.error("Erro do OvenPlayer:", errorData);
        setStatus('error')
				scheduleRetry();
			});

      player.on?.('destroy', () => {
        console.log('OvenPlayer destruído')
        setStatus('offline')
      })

			console.log("OvenPlayer inicializado com sucesso");
		} catch (error) {
			console.error("Erro ao inicializar OvenPlayer:", error);
			scheduleRetry();
		}
	}, [getStreamToken, getPlayerConfig, scheduleRetry]);

	useEffect(() => {// Configurar HLS.js globalmente para o OvenPlayer
    if (typeof window !== 'undefined') {
      (window as typeof window & { Hls: typeof Hls }).Hls = Hls
    }

    const cleanupPlayer = () => {
      if (ovenPlayerRef.current) {
        try {
          if (typeof ovenPlayerRef.current.destroy === 'function') {
            ovenPlayerRef.current.destroy()
          } else if (typeof ovenPlayerRef.current.remove === 'function') {
            ovenPlayerRef.current.remove()
          }
          ovenPlayerRef.current = null
        } catch (error) {
          console.error('Erro ao destruir player:', error)
        }
      }
    }
    
    // Aguardar o próximo ciclo de renderização para garantir que o DOM esteja pronto
    const timer = setTimeout(() => {
      initializePlayer()
    }, 50)
    
    return () => {
      clearTimeout(timer)
      cleanupPlayer()
    }
	}, []); // Dependência: initializePlayer

	// Não usar useEffect para retry - deixar apenas os event listeners do player lidarem com isso

	const getStatusIcon = () => {
		switch (status) {
			case "connecting":
				return <div className="loading-spinner" />;
			case "playing":
				return <Wifi className="status-icon live" />;
			case "offline":
				return <AlertCircle className="status-icon offline" />;
			case "error":
				return <WifiOff className="status-icon error" />;
			default:
				return <Wifi className="status-icon" />;
		}
	};

	const handleLogout = () => {
		logout();
		showToastRef.current("Logout realizado com sucesso", "info");
	};

	const handleAdminPanel = () => {
		setShowAdminScreen(true);
	};

	const handleStremioConfig = () => {
		setShowStremioConfig(true);
	};

	const handleManualRetry = () => {
		setRetryCount(0);
		setLastInitTime(0);
		setStatus("connecting");
		initializePlayer();
	};

	return (
		<div ref={playerContainerRef} className="stream-player">
			{/* Header com informações do usuário */}
			<div className="stream-header">
				<div className="user-info">
					<span>Bem-vindo, {user?.username}</span>
					<span className="user-role">({user?.role})</span>
				</div>
				<div className="header-actions">
					<button className="stremio-btn" onClick={handleStremioConfig}>
						<Play size={16} />
						Stremio
					</button>
					{user?.role === "admin" && (
						<button className="admin-btn" onClick={handleAdminPanel}>
							<Settings size={16} />
							Admin
						</button>
					)}
					<button className="logout-btn" onClick={handleLogout}>
						<LogOut size={16} />
						Sair
					</button>
				</div>
			</div>

			{/* Container do OvenPlayer */}
			<div id="ovenPlayer" className="oven-player-container" />

			{/* Loading/Status Overlay */}
			{(status === "connecting" ||
				status === "error" ||
				status === "offline") && (
				<div className="stream-overlay">
					<div className="overlay-content">
						{getStatusIcon()}
						<p className="status-text">
							{status === "connecting" && "Conectando à stream..."}
							{status === "offline" && "Stream está offline"}
							{status === "error" && "Erro na conexão"}
						</p>
						{(status === "error" || status === "offline") && (
							<button className="retry-btn" onClick={handleManualRetry}>
								Tentar Novamente
							</button>
						)}
						{status === "offline" && (
							<div className="offline-info">
								<p>A stream não está disponível no momento.</p>
								{retryCount < MAX_RETRY_ATTEMPTS ? (
									<p>
										Tentativas automáticas: {retryCount}/{MAX_RETRY_ATTEMPTS}
									</p>
								) : (
									<p>
										Tentativas automáticas esgotadas. Use "Tentar Novamente"
										para reconectar.
									</p>
								)}
							</div>
						)}
					</div>
				</div>
			)}

			{/* Tela Administrativa */}
			{showAdminScreen && (
				<AdminScreen
					showToast={showToastRef.current}
					onBack={() => setShowAdminScreen(false)}
					user={user}
				/>
			)}

			{/* Configuração do Stremio */}
			{showStremioConfig && (
				<StremioConfig
					showToast={showToastRef.current}
					onBack={() => setShowStremioConfig(false)}
				/>
			)}
		</div>
	);
};

export default OvenStreamPlayer;
