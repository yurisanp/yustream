import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import OvenPlayer from "ovenplayer";
import Hls from "hls.js";
import { useStreamStatus } from "./useStreamStatus";

type StreamStatus =
	| "connecting"
	| "playing"
	| "paused"
	| "error"
	| "offline"
	| "idle";

interface OvenPlayerInstance {
	on?: (event: string, callback: (data?: unknown) => void) => void;
	destroy?: () => void;
	remove?: () => void;
	getState?: () => string;
	play?: () => void;
	pause?: () => void;
}

interface UseStreamPlayerOptions {
	onStatusChange?: (status: StreamStatus) => void;
	onError?: (
		error: string | Error | { message?: string; code?: number }
	) => void;
	onStreamOnlineChange?: (isOnline: boolean) => void;
	getStreamToken: () => Promise<string | null>;
}

export const useStreamPlayer = ({
	onStatusChange,
	onError,
	onStreamOnlineChange,
	getStreamToken,
}: UseStreamPlayerOptions) => {
	const [status, setStatus] = useState<StreamStatus>("connecting");
	const [retryCount, setRetryCount] = useState(0);
	const [lastInitTime, setLastInitTime] = useState(0);
	const [currentToken, setCurrentToken] = useState<string | null>(null);
	const [isInitializing, setIsInitializing] = useState(false);

	const ovenPlayerRef = useRef<OvenPlayerInstance | null>(null);
	const playerContainerRef = useRef<HTMLDivElement>(null);
	const cleanupTimeoutRef = useRef<number | null>(null);
	const initializationAbortRef = useRef<AbortController | null>(null);

	// Constantes otimizadas para melhor performance
	const MAX_RETRY_ATTEMPTS = 2; // Reduzido de 3 para 2
	const MIN_RETRY_INTERVAL = 15000; // Aumentado para 15s
	const STREAM_ID = "live";

	// Detectar dispositivo para otimizações específicas
	const deviceType = useMemo(() => {
		const userAgent = navigator.userAgent.toLowerCase();
		const isMobile =
			/android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
				userAgent
			);
		const isTV =
			/smart-tv|smarttv|tv/i.test(userAgent) || window.innerWidth > 1920;
		return { isMobile, isTV };
	}, []);

	// Hook para verificar status da stream - SEM verificação periódica
	const streamStatus = useStreamStatus({
		checkInterval: 30000, // Intervalo para caso seja habilitado
		onStatusChange: onStreamOnlineChange,
		enablePeriodicCheck: false, // Desabilitar verificação periódica por padrão
		authToken: currentToken || undefined, // Passar o token atual para autenticação
	});

	// Configuração otimizada baseada no dispositivo
	const getPlayerConfig = useCallback(
		(streamToken: string | null) => {
			const hostname = window.location.hostname;
			const isSecure = window.location.protocol === "https:";
			const httpProtocol = isSecure ? "https:" : "http:";
			const httpPort = isSecure ? "8443" : "8080";
			const tokenParam = streamToken ? `?token=${streamToken}` : "";

			// Configurações otimizadas baseadas no tipo de dispositivo
			const baseConfig = {
				autoStart: true,
				autoFallback: true,
				controls: true,
				loop: false,
				muted: false,
				volume: deviceType.isMobile ? 80 : 100, // Volume menor em mobile para economizar bateria
				playbackRate: 1,
				playsinline: true,
				sources: [
					{
						label: "Baixa latência",
						type: "llhls" as const,
						file: `${httpProtocol}//${hostname}:${httpPort}/live/${STREAM_ID}/abr.m3u8${tokenParam}`,
						lowLatency: true,
					},
					{
						label: "Padrão",
						type: "hls" as const,
						file: `${httpProtocol}//${hostname}:${httpPort}/live/${STREAM_ID}/ts:abr.m3u8${tokenParam}`,
						lowLatency: false,
					},
				],
				hlsConfig: {
					autoStartLoad: true,
					startPosition: -1,
					debug: false,
					capLevelOnFPSDrop: false,
					capLevelToPlayerSize: false,
					defaultAudioCodec: undefined,
					initialLiveManifestSize: 1,
					maxBufferLength: 30,
					maxMaxBufferLength: 600,
					backBufferLength: Infinity,
					frontBufferFlushThreshold: Infinity,
					maxBufferSize: 60 * 1000 * 1000,
					maxBufferHole: 0.1,
					highBufferWatchdogPeriod: 2,
					nudgeOffset: 0.1,
					nudgeMaxRetry: 3,
					maxFragLookUpTolerance: 0.25,
					liveSyncDurationCount: 3,
					liveSyncOnStallIncrease: 1,
					liveMaxLatencyDurationCount: Infinity,
					liveDurationInfinity: false,
					preferManagedMediaSource: false,
					enableWorker: true,
					enableSoftwareAES: true,
					fragLoadPolicy: {
						default: {
							maxTimeToFirstByteMs: 9000,
							maxLoadTimeMs: 100000,
							timeoutRetry: {
								maxNumRetry: 2,
								retryDelayMs: 0,
								maxRetryDelayMs: 0,
							},
							errorRetry: {
								maxNumRetry: 5,
								retryDelayMs: 3000,
								maxRetryDelayMs: 15000,
								backoff: "linear",
							},
						},
					},
					startLevel: undefined,
					startFragPrefetch: false,
					testBandwidth: true,
					progressive: false,
					lowLatencyMode: true,
					fpsDroppedMonitoringPeriod: 5000,
					fpsDroppedMonitoringThreshold: 0.2,
					appendErrorMaxRetry: 3,
					enableDateRangeMetadataCues: true,
					enableMetadataCues: true,
					enableID3MetadataCues: true,
					enableWebVTT: true,
					enableIMSC1: true,
					enableCEA708Captions: true,
					stretchShortVideoTrack: false,
					maxAudioFramesDrift: 1,
					forceKeyFrameOnDiscontinuity: true,
					abrEwmaFastLive: 3.0,
					abrEwmaSlowLive: 9.0,
					abrEwmaFastVoD: 3.0,
					abrEwmaSlowVoD: 9.0,
					abrEwmaDefaultEstimate: 500000,
					abrEwmaDefaultEstimateMax: 5000000,
					abrBandWidthFactor: 0.95,
					abrBandWidthUpFactor: 0.7,
					abrMaxWithRealBitrate: false,
					maxStarvationDelay: 4,
					maxLoadingDelay: 4,
					minAutoBitrate: 0,
					emeEnabled: false,
					licenseXhrSetup: undefined,
					drmSystems: {},
					drmSystemOptions: {},
				},
			};

			return baseConfig;
		},
		[deviceType]
	);

	const updateStatus = useCallback(
		(newStatus: StreamStatus) => {
			setStatus(newStatus);
			onStatusChange?.(newStatus);
		},
		[onStatusChange]
	);

	const scheduleRetry = useCallback(() => {
		const now = Date.now();

		if (now - lastInitTime < MIN_RETRY_INTERVAL) {
			console.log("Retry muito rápido, ignorando...");
			return;
		}

		if (retryCount >= MAX_RETRY_ATTEMPTS) {
			updateStatus("offline");
			return;
		}

		setRetryCount((prev) => prev + 1);
		setLastInitTime(now);

		setTimeout(() => {
			// Usar uma referência para evitar dependência circular
			if (typeof window !== "undefined") {
				window.location.reload();
			}
		}, 5000);
	}, [retryCount, lastInitTime, updateStatus]);

	// Função de cleanup otimizada para evitar múltiplos players
	const cleanupPlayer = useCallback(() => {
		console.log("🧹 Iniciando cleanup do player...");

		// Cancelar inicialização em andamento
		if (initializationAbortRef.current) {
			initializationAbortRef.current.abort();
			initializationAbortRef.current = null;
		}

		// Limpar timeout de cleanup
		if (cleanupTimeoutRef.current) {
			clearTimeout(cleanupTimeoutRef.current);
			cleanupTimeoutRef.current = null;
		}

		// Parar verificação periódica da stream
		streamStatus.stopPeriodicCheck();

		// Destruir player existente
		if (ovenPlayerRef.current) {
			try {
				const player = ovenPlayerRef.current;
				console.log("🗑️ Destruindo player existente...");

				// Tentar pausar antes de destruir
				if (typeof player.pause === "function") {
					player.pause();
				}

				// Aguardar um pouco para garantir que o pause foi processado
				setTimeout(() => {
					try {
						if (typeof player.destroy === "function") {
							player.destroy();
						} else if (typeof player.remove === "function") {
							player.remove();
						}
					} catch (destroyError) {
						console.warn("Erro ao destruir player (ignorado):", destroyError);
					}
				}, 100);

				ovenPlayerRef.current = null;
			} catch (error) {
				console.error("Erro ao limpar player:", error);
				ovenPlayerRef.current = null; // Forçar limpeza mesmo com erro
			}
		}

		// Limpar elemento DOM do player para garantir que não há múltiplas instâncias
		const playerElement = document.getElementById("ovenPlayer");
		if (playerElement) {
			playerElement.innerHTML = "";
		}

		console.log("✅ Cleanup do player concluído");
	}, [streamStatus]);

	const initializePlayer = useCallback(async () => {
		console.log("🚀 Iniciando initializePlayer...");

		// Verificar se já está inicializando para evitar múltiplas chamadas
		if (isInitializing) {
			console.log("⚠️ Player já está sendo inicializado, ignorando...");
			return;
		}

		if (!playerContainerRef.current) {
			console.log("❌ playerContainerRef não encontrado");
			return;
		}

		// Criar AbortController para cancelar inicialização se necessário
		if (initializationAbortRef.current) {
			initializationAbortRef.current.abort();
		}
		initializationAbortRef.current = new AbortController();
		const abortSignal = initializationAbortRef.current.signal;

		try {
			setIsInitializing(true);
			console.log("📡 Atualizando status para connecting...");
			updateStatus("connecting");

			// Verificar se foi cancelado
			if (abortSignal.aborted) {
				console.log("🚫 Inicialização cancelada");
				return;
			}

			// Limpar player existente antes de criar um novo
			await new Promise<void>((resolve) => {
				if (ovenPlayerRef.current) {
					console.log(
						"🧹 Limpando player existente antes de inicializar novo..."
					);
					cleanupPlayer();
					// Aguardar um pouco para garantir que o cleanup foi concluído
					setTimeout(resolve, 200);
				} else {
					resolve();
				}
			});

			// Verificar se foi cancelado após cleanup
			if (abortSignal.aborted) {
				console.log("🚫 Inicialização cancelada após cleanup");
				return;
			}

			console.log("🔑 Obtendo token de stream...");
			const token = await getStreamToken();
			if (!token) {
				console.log("❌ Token não obtido");
				updateStatus("error");
				onError?.("Erro ao obter token de acesso à stream");
				return;
			}

			console.log("✅ Token obtido:", token.substring(0, 20) + "...");
			setCurrentToken(token);

			// Verificar se foi cancelado
			if (abortSignal.aborted) {
				console.log("🚫 Inicialização cancelada após obter token");
				return;
			}

			// Verificar se a stream está online antes de inicializar o player
			console.log("🔍 Verificando status da stream na inicialização...");
			const isStreamOnline = await streamStatus.checkOnce(token);
			console.log(
				"📊 Status da stream:",
				isStreamOnline ? "ONLINE" : "OFFLINE"
			);

			if (!isStreamOnline) {
				console.log("❌ Stream offline, não inicializando player");
				updateStatus("offline");
				onError?.("Stream está offline");
				return;
			}

			// Verificar se foi cancelado
			if (abortSignal.aborted) {
				console.log("🚫 Inicialização cancelada após verificar stream");
				return;
			}

			console.log("✅ Stream online, inicializando player...");

			// Garantir que o elemento DOM está limpo
			const playerElement = document.getElementById("ovenPlayer");
			if (playerElement) {
				playerElement.innerHTML = "";
			}

			// Criar novo player
			ovenPlayerRef.current = OvenPlayer.create(
				"ovenPlayer",
				getPlayerConfig(token)
			);

			if (!ovenPlayerRef.current) {
				throw new Error("Falha ao criar instância do OvenPlayer");
			}

			const player = ovenPlayerRef.current;

			// Configurar event listeners com verificação de abort
			player.on?.("ready", () => {
				if (!abortSignal.aborted) {
					console.log("OvenPlayer pronto");
					updateStatus("playing");
				}
			});

			player.on?.("stateChanged", (data: unknown) => {
				if (!abortSignal.aborted) {
					const stateData = data as { prevstate: string; newstate: string };
					console.log("Estado mudou:", stateData);

					switch (stateData.newstate) {
						case "playing":
							updateStatus("playing");
							break;
						case "paused":
							updateStatus("paused");
							break;
						case "loading":
							updateStatus("connecting");
							break;
						case "error":
							updateStatus("error");
							break;
					}
				}
			});

			player.on?.("error", async (error: unknown) => {
				if (!abortSignal.aborted) {
					const errorData = error as { message?: string; code?: number };
					console.error("Erro do OvenPlayer:", errorData);

					// Verificar se a stream ainda está online quando há erro
					console.log("🚨 Verificando status da stream devido ao erro...");
					const isStreamStillOnline = await streamStatus.checkOnError(
						currentToken || undefined
					);
					console.log(
						"📊 Status da stream após erro:",
						isStreamStillOnline ? "ONLINE" : "OFFLINE"
					);

					if (!isStreamStillOnline) {
						console.log("❌ Stream offline, mudando status para offline");
						updateStatus("offline");
						onError?.("Stream está offline");
					} else {
						console.log(
							"⚠️ Stream online, mas player com erro - tentando reconectar"
						);
						updateStatus("error");
						onError?.(errorData);
						scheduleRetry();
					}
				}
			});

			player.on?.("destroy", () => {
				if (!abortSignal.aborted) {
					console.log("OvenPlayer destruído");
					updateStatus("offline");
				}
			});

			console.log("OvenPlayer inicializado com sucesso");
		} catch (error) {
			if (!abortSignal.aborted) {
				console.error("Erro ao inicializar OvenPlayer:", error);
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				onError?.(errorMessage);
				scheduleRetry();
			}
		} finally {
			setIsInitializing(false);
			if (initializationAbortRef.current?.signal === abortSignal) {
				initializationAbortRef.current = null;
			}
		}
	}, [
		getStreamToken,
		getPlayerConfig,
		updateStatus,
		onError,
		scheduleRetry,
		streamStatus,
		currentToken,
		isInitializing,
		cleanupPlayer,
	]);

	const handleManualRetry = useCallback(async () => {
		console.log("🔄 Retry manual solicitado...");

		// Verificar se a stream está online antes de tentar reconectar
		if (currentToken) {
			console.log("🔍 Verificando status da stream antes do retry manual...");
			const isStreamOnline = await streamStatus.checkOnce(currentToken);
			console.log(
				"📊 Status da stream no retry:",
				isStreamOnline ? "ONLINE" : "OFFLINE"
			);

			if (!isStreamOnline) {
				console.log("❌ Stream offline, não fazendo retry");
				updateStatus("offline");
				onError?.("Stream está offline");
				return;
			}
		}

		setRetryCount(0);
		setLastInitTime(0);
		updateStatus("connecting");
		initializePlayer();
	}, [initializePlayer, updateStatus, currentToken, streamStatus, onError]);

	useEffect(() => {
		if (typeof window !== "undefined") {
			(window as typeof window & { Hls: typeof Hls }).Hls = Hls;
		}

		const timer = setTimeout(() => {
			initializePlayer();
		}, 50);

		return () => {
			clearTimeout(timer);
			cleanupPlayer();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []); // Dependências removidas para evitar loop infinito

	// Removido: Efeito para monitorar mudanças no status da stream
	// Agora só verificamos o status na inicialização e quando há erros

	return {
		status,
		retryCount,
		playerContainerRef,
		handleManualRetry,
		MAX_RETRY_ATTEMPTS,
		streamStatus: {
			isOnline: streamStatus.isOnline,
			isLoading: streamStatus.isLoading,
			error: streamStatus.error,
			lastChecked: streamStatus.lastChecked,
			hasWebRTC: streamStatus.hasWebRTC,
			hasLLHLS: streamStatus.hasLLHLS,
			totalActiveStreams: streamStatus.totalActiveStreams,
			streamDetails: streamStatus.streamDetails,
			method: streamStatus.method,
		},
	};
};
