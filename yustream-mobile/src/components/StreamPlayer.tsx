import React, {
	memo,
	useCallback,
	useMemo,
	useState,
	useRef,
	useEffect,
} from "react";
import {
	View,
	Text,
	StyleSheet,
	Dimensions,
	ActivityIndicator,
	TouchableOpacity,
	Alert,
	Platform,
	Pressable,
} from "react-native";
import {
	Gesture,
	GestureDetector,
	GestureHandlerRootView,
} from "react-native-gesture-handler";
import { VideoView, VideoSource, useVideoPlayer } from "expo-video";
import { StatusBar } from "expo-status-bar";
import { Ionicons } from "@expo/vector-icons";
import { useStreamPlayer } from "../hooks/useStreamPlayer";
import { useFullscreenPlayer } from "../hooks/useFullscreenPlayer";
import PlayerControls from "./PlayerControls";
import ConfirmDialog from "./ConfirmDialog";
import { StreamStatus, StreamPlayerOptions } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { useConfirmDialog } from "../hooks/useConfirmDialog";
import { useEvent } from "expo";

interface StreamPlayerProps extends StreamPlayerOptions {
	style?: any;
	showControls?: boolean;
	showStatusBar?: boolean;
	resizeMode?: string;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

const StreamPlayer = memo<StreamPlayerProps>(
	({
		style,
		showControls = true,
		showStatusBar = true,
		resizeMode = "contain",
		onStatusChange,
		onError,
		onStreamOnlineChange,
		getStreamToken,
	}) => {
		const [currentQuality, setCurrentQuality] = useState("auto");

		// Refs
		const videoRef = useRef<VideoView>(null);

		// Hook do player
		const {
			status,
			retryCount,
			streamSources,
			isBuffering,
			streamStatus,
			streamQualities,
			currentToken,
			MAX_RETRY_ATTEMPTS,
			handleManualRetry,
			validateStreamToken,
			checkAndRenewToken,
			playerHandlers,
		} = useStreamPlayer({
			onStatusChange,
			onError,
			onStreamOnlineChange,
			getStreamToken,
		});

		// Função para mostrar informações sobre qualidades
		const showQualityDetails = useCallback(() => {
			const { stats, activeQualities } = streamQualities;

			const qualityList = activeQualities
				.map((q) => `• ${q.displayName}: ${q.state || "Ativa"}`)
				.join("\n");

			const message = [
				`📊 Qualidades Disponíveis:`,
				``,
				`📺 Qualidades Individuais: ${stats.active}/${stats.total}`,
				``,
				...(qualityList ? [qualityList] : []),
				``,
				`🔄 Última verificação: ${
					streamQualities.lastChecked
						? new Date(streamQualities.lastChecked).toLocaleTimeString()
						: "Nunca"
				}`,
			].join("\n");

			Alert.alert("Informações de Qualidade", message, [{ text: "OK" }]);
		}, [streamQualities]);

		// Hook de autenticação para logout
		const { logout } = useAuth();

		// Hook para diálogos de confirmação
		const { dialogState, showConfirmDialog } = useConfirmDialog();

		// Função para logout
		const handleLogout = useCallback(async () => {
			showConfirmDialog(
				{
					title: "Sair da Conta",
					message: "Tem certeza que deseja sair da sua conta?",
					confirmText: "Sair",
					cancelText: "Cancelar",
					confirmStyle: "destructive",
				},
				async () => {
					try {
						await logout();
						// O AuthContext automaticamente redireciona para LoginScreen
						// quando isAuthenticated se torna false
					} catch (error) {
						console.error("Erro no logout:", error);
						// Em caso de erro, mostrar outro diálogo
						showConfirmDialog(
							{
								title: "Erro",
								message: "Erro inesperado ao fazer logout",
								confirmText: "OK",
								cancelText: "",
							},
							() => {},
							() => {}
						);
					}
				}
			);
		}, [logout, showConfirmDialog]);

		// Hook do fullscreen
		const {
			isFullscreen,
			dimensions,
			showControls: showPlayerControls,
			toggleFullscreen,
			toggleControls,
			setShowControls: setShowPlayerControls,
			containerRef,
			isWebPlatform,
		} = useFullscreenPlayer();

		// Qualidades disponíveis baseadas nas fontes
		const availableQualities = useMemo(() => {
			const qualities = [
				{ label: "Auto", value: "auto", resolution: "Adaptativo" },
			];

			streamSources.forEach((source, index) => {
				qualities.push({
					label: source.label,
					value: `source_${index}`,
					resolution: source.label === "Baixa Latência" ? "1080p" : "720p",
				});
			});

			return qualities;
		}, [streamSources]);

		// Fonte do vídeo baseada na qualidade selecionada
		const videoSource = useMemo((): VideoSource | null => {
			if (streamSources.length === 0) return null;

			let selectedSource = streamSources[0]; // Default para primeira fonte

			if (currentQuality !== "auto" && currentQuality.startsWith("source_")) {
				const sourceIndex = parseInt(currentQuality.replace("source_", ""), 10);
				if (sourceIndex >= 0 && sourceIndex < streamSources.length) {
					selectedSource = streamSources[sourceIndex];
				}
			}

			return {
				uri: selectedSource.uri,
				headers: {
					"User-Agent": "YuStream Mobile/1.0",
					"Access-Control-Allow-Origin": "*"
				},
				contentType: "hls"
			};
		}, [streamSources, currentQuality]);

		// Estado para controlar se está ao vivo ou atrasado
		const [isLive, setIsLive] = useState(true);
		const [isSeeking, setIsSeeking] = useState(false);

		// Player de vídeo usando o hook com configurações otimizadas para stream ao vivo
		const videoPlayer = useVideoPlayer(videoSource, (player) => {
			// Configurações otimizadas para stream ao vivo
			player.loop = false;
			player.muted = false;
			player.volume = 1.0;
			player.bufferOptions = {waitsToMinimizeStalling: false, preferredForwardBufferDuration: 4};
			player.timeUpdateEventInterval = 1;
			player.play(); // Start playing immediately
		});

		const { isPlaying } = useEvent(videoPlayer, "playingChange", {
			isPlaying: videoPlayer.playing,
		});

		// Listener para atualizar tempo atual
		const timeUpdateEvent = useEvent(videoPlayer, "timeUpdate", {
			currentTime: videoPlayer.currentTime,
			duration: videoPlayer.duration,
			currentLiveTimestamp: videoPlayer.currentTime,
			currentOffsetFromLive: videoPlayer.currentOffsetFromLive,
			bufferedPosition: videoPlayer.currentTime,
		});

		// Função para voltar ao vivo
		const goToLive = useCallback(async () => {
			try {
				if (videoPlayer) {
					console.log("[StreamPlayer] Voltando ao vivo...");
					setIsLive(true);
					setIsSeeking(true);

					// Para streams ao vivo, recarregar a fonte para voltar ao live
					await videoPlayer.replaceAsync(videoSource);
					videoPlayer.play();

					setIsSeeking(false);
					console.log("[StreamPlayer] Voltou ao vivo com sucesso");
				}
			} catch (error) {
				console.error("[StreamPlayer] Erro ao voltar ao vivo:", error);
				setIsSeeking(false);
			}
		}, [videoPlayer, videoSource]);

		// Função para verificar se está próximo do live
		const checkLiveStatus = useCallback(() => {
			if (
				timeUpdateEvent.currentOffsetFromLive != null &&
				timeUpdateEvent.currentOffsetFromLive > 5
			) {
				setIsLive(false);

				console.log(
					`[StreamPlayer] Usuário atrasado em ${timeUpdateEvent.currentOffsetFromLive.toFixed(
						1
					)} segundos`
				);
			} else {
				setIsLive(true);
			}
		}, [timeUpdateEvent]);

		// Atualizar status ao vivo quando o tempo muda
		useEffect(() => {
			checkLiveStatus();
		}, [checkLiveStatus]);

		// Handlers dos controles
		const handlePlayPause = useCallback(async () => {
			try {
				if (videoPlayer) {
					if (isPlaying) {
						videoPlayer.pause();
					} else {
						videoPlayer.play();
					}
				}
			} catch (error) {
				console.error("[StreamPlayer] Erro ao play/pause:", error);
			}
		}, [isPlaying, videoPlayer]);

		const handleQualityChange = useCallback((quality: string) => {
			console.log("[StreamPlayer] Mudando qualidade para:", quality);
			setCurrentQuality(quality);
		}, []);

		const handleReload = useCallback(() => {
			console.log("[StreamPlayer] Recarregando player...");
			handleManualRetry();
		}, [handleManualRetry]);

		// Handler para toques na tela (toggle controles)
		const handleScreenPress = useCallback(() => {
			toggleControls();

			console.log("pressing by");
		}, [toggleControls]);

		// Handler para retry manual
		const handleRetryPress = useCallback(() => {
			showConfirmDialog(
				{
					title: "Tentar Novamente",
					message: "Deseja tentar reconectar à stream?",
					confirmText: "Sim",
					cancelText: "Cancelar",
				},
				handleManualRetry
			);
		}, [handleManualRetry, showConfirmDialog]);

		const renderLogoutButton = () => (
			<TouchableOpacity
				style={styles.controlButton}
				onPress={() => {
					handleLogout?.();
				}}
			>
				<Ionicons
					name="log-out"
					size={isFullscreen ? 24 : 20}
					color="#FFFFFF"
				/>
			</TouchableOpacity>
		);

		const tapGesture = Gesture.Tap()
			.maxDuration(300)
			.onEnd(() => {
				handleScreenPress();
			})
			.runOnJS(true);

		// Renderização condicional baseada no status
		const renderContent = () => {
			// Mostrar player quando há fontes disponíveis e status é adequado
			if (videoSource && (status === "playing" || status === "connecting")) {
				return (
					<View
						style={[
							styles.playerContainer,
							isFullscreen && styles.playerContainerFullscreen,
						]}
					>
						<View style={styles.videoContainer}>
							{videoSource && (
								<VideoView
									ref={videoRef}
									player={videoPlayer}
									style={[styles.video, isFullscreen && styles.videoFullscreen]}
									nativeControls={false} // Usar controles customizados
									contentFit="contain"
									allowsPictureInPicture={true}
									startsPictureInPictureAutomatically={true}
								/>
							)}
						</View>

						{/* Controles customizados */}
						<PlayerControls
							isPlaying={isPlaying}
							isBuffering={isBuffering || status === "connecting" || isSeeking}
							isFullscreen={isFullscreen}
							currentOffsetFromLive={
								timeUpdateEvent.currentOffsetFromLive
									? timeUpdateEvent.currentOffsetFromLive
									: 0
							}
							isLive={isLive}
							handleScreenPress={handleScreenPress}
							qualities={availableQualities}
							currentQuality={currentQuality}
							onPlayPause={handlePlayPause}
							onQualityChange={handleQualityChange}
							onFullscreenToggle={toggleFullscreen}
							onReload={handleReload}
							onGoToLive={goToLive}
							showControls={showPlayerControls}
							onControlsVisibilityChange={setShowPlayerControls}
							onShowQualityInfo={showQualityDetails}
							onLogout={handleLogout}
						/>

						{/* Overlay de buffering central */}
						{status === "connecting" && (
							<View style={styles.bufferingOverlay}>
								<ActivityIndicator
									size="large"
									color="#007AFF"
									style={styles.bufferingIndicator}
								/>
								<Text
									style={[
										styles.bufferingText,
										isFullscreen && styles.bufferingTextFullscreen,
									]}
								>
									{status === "connecting" ? "Conectando..." : "Carregando..."}
								</Text>
							</View>
						)}
					</View>
				);
			}

			// Status de erro
			if (status === "error") {
				return (
					<View style={styles.errorContainer}>
						<Ionicons name="alert-circle-outline" size={64} color="#FF3B30" />
						<Text style={styles.errorTitle}>Erro na Conexão</Text>
						<Text style={styles.errorMessage}>
							Não foi possível conectar à stream
						</Text>

						{retryCount < MAX_RETRY_ATTEMPTS ? (
							<Text style={styles.retryInfo}>
								Tentativas: {retryCount}/{MAX_RETRY_ATTEMPTS}
							</Text>
						) : (
							<Text style={styles.retryInfo}>
								Tentativas automáticas esgotadas
							</Text>
						)}

						<TouchableOpacity
							style={styles.retryButton}
							onPress={handleRetryPress}
						>
							<Ionicons name="refresh" size={20} color="#FFFFFF" />
							<Text style={styles.retryButtonText}>Tentar Novamente</Text>
						</TouchableOpacity>
					</View>
				);
			}

			// Status offline
			if (status === "offline" || !streamStatus.isOnline) {
				return (
					<View style={styles.offlineContainer}>
						<Ionicons name="wifi-outline" size={64} color="#FF9500" />
						<Text style={styles.offlineTitle}>Stream Offline</Text>
						<Text style={styles.offlineMessage}>
							A transmissão não está disponível no momento
						</Text>

						{streamStatus.lastChecked && (
							<Text style={styles.lastChecked}>
								Última verificação:{" "}
								{streamStatus.lastChecked.toLocaleTimeString()}
							</Text>
						)}

						<TouchableOpacity
							style={styles.retryButton}
							onPress={handleRetryPress}
						>
							<Ionicons name="refresh" size={20} color="#FFFFFF" />
							<Text style={styles.retryButtonText}>Verificar Novamente</Text>
						</TouchableOpacity>
					</View>
				);
			}

			// Estado padrão (connecting)
			return (
				<View style={styles.loadingContainer}>
					<ActivityIndicator size="large" color="#007AFF" />
					<Text style={styles.loadingText}>Inicializando player...</Text>
				</View>
			);
		};

		// Configurar referência para fullscreen web
		const setContainerRef = useCallback((element: any) => {
			if (isWebPlatform && containerRef && element) {
				// No web, o elemento é um HTMLElement
				if (Platform.OS === 'web') {
					(containerRef as any).current = element;
				}
			}
		}, [isWebPlatform, containerRef]);

		return (
			<View
				style={[
					styles.container,
					style,
					isFullscreen && styles.containerFullscreen,
				]}
				ref={isWebPlatform ? setContainerRef : undefined}
			>
				{showStatusBar && !isFullscreen && (
					<StatusBar style="light" backgroundColor="transparent" />
				)}

				{/* Indicador de status da stream (apenas quando não estiver em fullscreen) */}
				{!isFullscreen && (
					<View style={styles.statusBar}>
						<View
							style={[
								styles.statusIndicator,
								{
									backgroundColor: streamStatus.isOnline
										? "#34C759"
										: "#FF3B30",
								},
							]}
						/>
						<Text style={styles.statusText}>
							{streamStatus.isOnline ? "Stream Online" : "Stream Offline"}
						</Text>
						{streamStatus.isLoading && (
							<ActivityIndicator
								size="small"
								color="#007AFF"
								style={styles.statusLoader}
							/>
						)}
						{renderLogoutButton()}
					</View>
				)}

				{/* Conteúdo principal */}
				{renderContent()}

				{/* Diálogo de confirmação */}
				<ConfirmDialog
					visible={dialogState.visible}
					title={dialogState.title}
					message={dialogState.message}
					confirmText={dialogState.confirmText}
					cancelText={dialogState.cancelText}
					confirmStyle={dialogState.confirmStyle}
					onConfirm={dialogState.onConfirm}
					onCancel={dialogState.onCancel}
				/>
			</View>
		);
	}
);

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#000000",
		justifyContent: "center",
		alignItems: "center",
	},
	containerFullscreen: {
		position: "absolute",
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		zIndex: 1000,
	},
	statusBar: {
		position: "absolute",
		top: Platform.OS === "ios" ? 50 : Platform.OS === 'web' ? 2 : 30,
		left: 8,
		right: 8,
		flexDirection: "row",
		alignItems: "center",
		zIndex: 1000,
		backgroundColor: "rgba(0, 0, 0, 0.7)",
		paddingHorizontal: 4,
		paddingVertical: 8,
		borderRadius: 20,
	},
	statusIndicator: {
		width: 8,
		height: 8,
		borderRadius: 4,
		marginRight: 8,
	},
	statusText: {
		color: "#FFFFFF",
		fontSize: 14,
		fontWeight: "500",
		flex: 1,
	},
	statusLoader: {
		marginLeft: 8,
	},
	tokenIndicator: {
		flexDirection: "row",
		alignItems: "center",
		marginLeft: 12,
		gap: 4,
	},
	tokenDot: {
		width: 6,
		height: 6,
		borderRadius: 3,
	},
	tokenText: {
		color: "#FFFFFF",
		fontSize: 10,
		fontWeight: "500",
	},
	playerContainer: {
		width: screenWidth,
		height: screenHeight,
		position: "relative",
	},
	playerContainerFullscreen: {
		width: "100%",
		height: "100%",
	},
	controlButton: {
		padding: 6,
		borderRadius: 6,
		backgroundColor: "rgba(0, 0, 0, 0.6)",
		alignItems: "center",
		justifyContent: "center",
		minWidth: 32,
		minHeight: 32,
	},
	videoContainer: {
		flex: 1,
		width: "100%",
		height: "100%",
	},
	video: {
		width: "100%",
		height: "100%",
	},
	videoFullscreen: {
		width: "100%",
		height: "100%",
	},
	bufferingOverlay: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: "rgba(0, 0, 0, 0.7)",
		justifyContent: "center",
		alignItems: "center",
		zIndex: 100,
	},
	bufferingIndicator: {
		marginBottom: 16,
	},
	bufferingText: {
		color: "#FFFFFF",
		fontSize: 16,
		fontWeight: "500",
	},
	bufferingTextFullscreen: {
		fontSize: 18,
	},
	loadingContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: 32,
	},
	loadingText: {
		color: "#FFFFFF",
		fontSize: 16,
		marginTop: 16,
		textAlign: "center",
	},
	errorContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: 32,
	},
	errorTitle: {
		color: "#FFFFFF",
		fontSize: 24,
		fontWeight: "bold",
		marginTop: 16,
		marginBottom: 8,
		textAlign: "center",
	},
	errorMessage: {
		color: "#CCCCCC",
		fontSize: 16,
		textAlign: "center",
		marginBottom: 16,
	},
	retryInfo: {
		color: "#999999",
		fontSize: 14,
		marginBottom: 24,
		textAlign: "center",
	},
	offlineContainer: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
		padding: 32,
	},
	offlineTitle: {
		color: "#FFFFFF",
		fontSize: 24,
		fontWeight: "bold",
		marginTop: 16,
		marginBottom: 8,
		textAlign: "center",
	},
	offlineMessage: {
		color: "#CCCCCC",
		fontSize: 16,
		textAlign: "center",
		marginBottom: 16,
	},
	lastChecked: {
		color: "#999999",
		fontSize: 12,
		marginBottom: 24,
		textAlign: "center",
	},
	retryButton: {
		backgroundColor: "#007AFF",
		flexDirection: "row",
		alignItems: "center",
		paddingHorizontal: 24,
		paddingVertical: 12,
		borderRadius: 25,
		elevation: 2,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 4,
	},
	retryButtonText: {
		color: "#FFFFFF",
		fontSize: 16,
		fontWeight: "600",
		marginLeft: 8,
	},
});

StreamPlayer.displayName = "StreamPlayer";

export default StreamPlayer;
