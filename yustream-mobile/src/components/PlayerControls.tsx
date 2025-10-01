import React, { useState, useCallback, useEffect, useRef } from "react";
import {
	View,
	Text,
	TouchableOpacity,
	StyleSheet,
	Animated,
	Dimensions,
	Modal,
	ScrollView,
	Platform,
  Pressable,
  GestureResponderEvent,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ScreenOrientation from "expo-screen-orientation";
import { useKeepAwake } from "expo-keep-awake";
import { Gesture, GestureDetector } from "react-native-gesture-handler";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

interface QualityOption {
	label: string;
	value: string;
	bitrate?: number;
	resolution?: string;
}

interface PlayerControlsProps {
	isPlaying: boolean;
	isBuffering: boolean;
	isFullscreen: boolean;
	currentOffsetFromLive: number;
	isLive?: boolean;
	qualities: QualityOption[];
	currentQuality: string;
	handleScreenPress: () => void;
	onPlayPause: () => void;
	onQualityChange: (quality: string) => void;
	onFullscreenToggle: () => void;
	onReload: () => void;
	onGoToLive?: () => void;
	showControls: boolean;
	onControlsVisibilityChange: (visible: boolean) => void;
	onShowQualityInfo?: () => void;
	onLogout?: () => void;
}

const PlayerControls: React.FC<PlayerControlsProps> = ({
	isPlaying,
	isBuffering,
	isFullscreen,
	currentOffsetFromLive,
	isLive = true,
	qualities,
	currentQuality,
	handleScreenPress,
	onPlayPause,
	onQualityChange,
	onFullscreenToggle,
	onGoToLive,
	showControls,
	onControlsVisibilityChange,
}) => {
	// Estados
	const [showQualitySelector, setShowQualitySelector] = useState(false);

	// Animações
	const controlsOpacity = useRef(
		new Animated.Value(showControls ? 1 : 0)
	).current;
	const fadeTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

	// Efeito para animação dos controles
	useEffect(() => {
		Animated.timing(controlsOpacity, {
			toValue: showControls ? 1 : 0,
			duration: 300,
			useNativeDriver: true,
		}).start();
	}, [showControls, controlsOpacity]);

	// Auto-hide dos controles
	const resetHideTimer = useCallback(() => {
		if (fadeTimeout.current) {
			clearTimeout(fadeTimeout.current);
		}

		if (showControls && isPlaying) {
			fadeTimeout.current = setTimeout(() => {
				onControlsVisibilityChange(false);
			}, 5000); // Esconder após 5 segundos
		}
	}, [showControls, isPlaying, onControlsVisibilityChange]);

	useEffect(() => {
		resetHideTimer();
		return () => {
			if (fadeTimeout.current) {
				clearTimeout(fadeTimeout.current);
			}
		};
	}, [resetHideTimer]);

	// Handlers
	const handlePlayPause = useCallback(() => {
		onPlayPause();
		resetHideTimer();
	}, [onPlayPause, resetHideTimer]);

	const handleFullscreenToggle = useCallback(async (e: GestureResponderEvent) => {
    e.stopPropagation();
		try {
			if (Platform.OS !== 'web') {
				// Lógica de orientação apenas para mobile
				if (isFullscreen) {
					await ScreenOrientation.lockAsync(
						ScreenOrientation.OrientationLock.PORTRAIT_UP
					);
				} else {
					await ScreenOrientation.unlockAsync();
				}
			}
			// Chamar o toggle do hook que já gerencia web/mobile
			onFullscreenToggle();
			resetHideTimer();
		} catch (error) {
			console.error("Erro ao alterar fullscreen:", error);
		}
	}, [isFullscreen, onFullscreenToggle, resetHideTimer]);

	const handleQualitySelect = useCallback(
		(quality: string) => {
			onQualityChange(quality);
			setShowQualitySelector(false);
			resetHideTimer();
		},
		[onQualityChange, resetHideTimer]
	);

	// Render dos controles
	const renderPlayPauseButton = () => (
		<TouchableOpacity
			style={[styles.controlButton, styles.centerPlayButton]}
			onPress={handlePlayPause}
			disabled={isBuffering}
		>
			{isBuffering ? (
				<Ionicons
					name="refresh"
					size={isFullscreen ? 32 : 24}
					color="#FFFFFF"
				/>
			) : (
				<Ionicons
					name={isPlaying ? "pause" : "play"}
					size={isFullscreen ? 32 : 24}
					color="#FFFFFF"
				/>
			)}
		</TouchableOpacity>
	);

	const renderQualityButton = () => (
		<TouchableOpacity
			style={styles.controlButton}
			onPress={() => {
				setShowQualitySelector(true);
				resetHideTimer();
			}}
		>
			<View style={styles.qualityButtonContainer}>
				<Ionicons
					name="settings"
					size={isFullscreen ? 24 : 20}
					color="#FFFFFF"
				/>
				<Text
					style={[
						styles.qualityText,
						isFullscreen && styles.qualityTextFullscreen,
					]}
				>
					{qualities.find((q) => q.value === currentQuality)?.label || "Auto"}
				</Text>
			</View>
		</TouchableOpacity>
	);

	const renderFullscreenButton = () => (
		<TouchableOpacity
			style={styles.controlButton}
			onPress={handleFullscreenToggle}
		>
			<Ionicons
				name={isFullscreen ? "contract" : "expand"}
				size={isFullscreen ? 24 : 20}
				color="#FFFFFF"
			/>
		</TouchableOpacity>
	);

	const renderGoToLiveButton = () => {
		if (!onGoToLive || isLive) return null;

		return (
			<TouchableOpacity
				style={[styles.controlButton, styles.goToLiveButton]}
				onPress={onGoToLive}
			>
				<Ionicons name="radio" size={isFullscreen ? 24 : 20} color="#FFFFFF" />
				<Text
					style={[
						styles.goToLiveText,
						isFullscreen && styles.goToLiveTextFullscreen,
					]}
				>
					AO VIVO
				</Text>
			</TouchableOpacity>
		);
	};

	const renderProgressSlider = () => {
		// Para streams ao vivo, mostrar slider apenas se houver duração válida
		if (currentOffsetFromLive <= 5) {
			// Mostrar apenas tempo atual para streams ao vivo
			return (
				<View style={styles.progressContainer}>
					<View style={styles.progressBarContainer}>
						<View style={styles.progressBarBackground}>
							<View style={[styles.progressBarFill, styles.liveProgressBar]} />
						</View>
					</View>
					<Text
						style={[styles.timeText, isFullscreen && styles.timeTextFullscreen]}
					>
						AO VIVO
					</Text>
				</View>
			);
		}

		const progress = Math.min(60 / currentOffsetFromLive, 1);

		return (
			<View style={styles.progressContainer}>
				<View style={styles.progressBarContainer}>
					<View style={styles.progressBarBackground}>
						<View
							style={[styles.progressBarFill, { width: `${progress * 100}%` }]}
						/>
					</View>
				</View>
				<Text
					style={[styles.timeText, isFullscreen && styles.timeTextFullscreen]}
				>
					-{formatTime(currentOffsetFromLive)}
				</Text>
			</View>
		);
	};

	const formatTime = (seconds: number): string => {
		const hours = Math.floor(seconds / 3600);
		const minutes = Math.floor((seconds % 3600) / 60);
		const secs = Math.floor(seconds % 60);

		if (hours > 0) {
			return `${hours}:${minutes.toString().padStart(2, "0")}:${secs
				.toString()
				.padStart(2, "0")}`;
		}
		return `${minutes}:${secs.toString().padStart(2, "0")}`;
	};

	// Modal do seletor de qualidade
	const renderQualitySelector = () => (
		<Modal
			visible={showQualitySelector}
			transparent
			animationType="fade"
			onRequestClose={() => setShowQualitySelector(false)}
		>
			<TouchableOpacity
				style={styles.modalOverlay}
				activeOpacity={1}
				onPress={() => setShowQualitySelector(false)}
			>
				<View
					style={[
						styles.qualityModal,
						isFullscreen && styles.qualityModalFullscreen,
					]}
				>
					<View style={styles.qualityHeader}>
						<Text style={styles.qualityTitle}>Qualidade do Vídeo</Text>
						<TouchableOpacity
							onPress={() => setShowQualitySelector(false)}
							style={styles.closeButton}
						>
							<Ionicons name="close" size={24} color="#FFFFFF" />
						</TouchableOpacity>
					</View>

					<ScrollView style={styles.qualityList}>
						{qualities.map((quality) => (
							<TouchableOpacity
								key={quality.value}
								style={[
									styles.qualityOption,
									currentQuality === quality.value &&
										styles.qualityOptionSelected,
								]}
								onPress={() => handleQualitySelect(quality.value)}
							>
								<View style={styles.qualityOptionContent}>
									<Text style={styles.qualityOptionLabel}>{quality.label}</Text>
								</View>
								{currentQuality === quality.value && (
									<Ionicons name="checkmark" size={20} color="#007AFF" />
								)}
							</TouchableOpacity>
						))}
					</ScrollView>
				</View>
			</TouchableOpacity>
		</Modal>
	);

	const tapGesture = Gesture.Tap()
		.maxDuration(300)
		.onEnd(() => {
			handleScreenPress();
		})
		.runOnJS(true);

	return (
		<>

				<Animated.View
					style={[
						styles.controlsContainer,
						isFullscreen && styles.controlsContainerFullscreen,
						{ opacity: controlsOpacity },
					]}
          onTouchEnd={handleScreenPress}
				>
					{/* Controles centrais */}
					<View style={styles.centerControls}>{renderPlayPauseButton()}</View>

					{/* Controles inferiores */}
					<View
						style={[
							styles.bottomControls,
							isFullscreen && styles.bottomControlsFullscreen,
						]}
					>
						{/* Slider de progresso */}
						{renderProgressSlider()}

						<View style={styles.bottomButtonsContainer}>
							<View style={styles.leftButtons}>
								{renderQualityButton()}
								{renderGoToLiveButton()}
							</View>
							<View style={styles.rightButtons}>
								{renderFullscreenButton()}
							</View>
						</View>
					</View>
				</Animated.View>

				{/* Seletor de qualidade */}
			{renderQualitySelector()}
		</>
	);
};

const styles = StyleSheet.create({
	controlsContainer: {
		...StyleSheet.absoluteFillObject,
		backgroundColor: "rgba(0, 0, 0, 0.3)",
		justifyContent: "space-between",
		paddingHorizontal: 16,
		paddingVertical: Platform.OS != 'web' ? 20 : 0,
		flexDirection: "column",
	},
	controlsContainerFullscreen: {
		paddingHorizontal: 24,
		paddingVertical: 30,
	},

	// Controles superiores
	topControls: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		paddingTop: Platform.OS === "ios" ? 20 : 0,
	},
	topControlsFullscreen: {
		paddingTop: Platform.OS === "ios" ? 40 : 20,
	},
	streamTitle: {
		color: "#FFFFFF",
		fontSize: 16,
		fontWeight: "600",
		flex: 1,
	},
	streamTitleFullscreen: {
		fontSize: 18,
	},
	topRightControls: {
		flexDirection: "row",
		gap: 6,
		alignItems: "center",
		justifyContent: "flex-end",
	},

	// Controles centrais
	centerControls: {
		flex: 1,
		alignItems: "center",
		justifyContent: "center",
	},

	// Controles inferiores
	bottomControls: {
		gap: 12,
		marginTop: "auto", // Empurrar para a parte inferior
	},
	bottomControlsFullscreen: {
		gap: 16,
	},
	bottomButtonsContainer: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
	},
	leftButtons: {
		flexDirection: "row",
		gap: 12,
	},
	rightButtons: {
		flexDirection: "row",
		gap: 12,
	},

	// Botões
	controlButton: {
		padding: 6,
		borderRadius: 6,
		backgroundColor: "rgba(0, 0, 0, 0.6)",
		alignItems: "center",
		justifyContent: "center",
		minWidth: 32,
		minHeight: 32,
	},
	centerPlayButton: {
		padding: 12,
		borderRadius: 50,
		backgroundColor: "rgba(0, 0, 0, 0.8)",
		minWidth: 60,
		minHeight: 60,
		elevation: 4,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 4,
	},

	// Slider de Volume
	volumeSliderContainer: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "rgba(0, 0, 0, 0.7)",
		paddingHorizontal: 12,
		paddingVertical: 8,
		borderRadius: 20,
		marginTop: 10,
		gap: 8,
	},
	volumeLabel: {
		color: "#FFFFFF",
		fontSize: 12,
		fontWeight: "500",
		minWidth: 50,
	},
	volumeSlider: {
		flex: 1,
		height: 20,
		justifyContent: "center",
	},
	volumeTrack: {
		height: 4,
		backgroundColor: "rgba(255, 255, 255, 0.3)",
		borderRadius: 2,
		position: "relative",
	},
	volumeProgress: {
		height: "100%",
		backgroundColor: "#007AFF",
		borderRadius: 2,
	},
	volumeThumb: {
		position: "absolute",
		width: 12,
		height: 12,
		backgroundColor: "#FFFFFF",
		borderRadius: 6,
		top: -4,
		marginLeft: -6,
	},
	volumeValue: {
		color: "#FFFFFF",
		fontSize: 12,
		fontWeight: "600",
		minWidth: 35,
		textAlign: "center",
	},

	// Indicador AO VIVO
	liveIndicator: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "#FF0000",
		paddingHorizontal: 8,
		paddingVertical: 4,
		borderRadius: 12,
		gap: 4,
	},
	liveDot: {
		width: 6,
		height: 6,
		borderRadius: 3,
		backgroundColor: "#FFFFFF",
	},
	liveText: {
		color: "#FFFFFF",
		fontSize: 10,
		fontWeight: "bold",
	},

	// Barra de progresso
	progressContainer: {
		flexDirection: "row",
		alignItems: "center",
		gap: 12,
	},
	progressBarContainer: {
		flex: 1,
		height: 20,
		justifyContent: "center",
		position: "relative",
	},
	progressBarBackground: {
		height: 4,
		backgroundColor: "rgba(255, 255, 255, 0.3)",
		borderRadius: 2,
	},
	progressBarFill: {
		position: "absolute",
		height: 4,
		backgroundColor: "#007AFF",
		borderRadius: 2,
	},
	liveProgressBar: {
		width: "100%", // Para streams ao vivo, preencher toda a barra
		backgroundColor: "#34C759", // Verde para indicar ao vivo
	},
	progressHandle: {
		position: "absolute",
		width: 16,
		height: 16,
		backgroundColor: "#007AFF",
		borderRadius: 8,
		marginLeft: -8,
		marginTop: -6,
		elevation: 2,
		shadowColor: "#000",
		shadowOffset: { width: 0, height: 2 },
		shadowOpacity: 0.25,
		shadowRadius: 4,
	},
	timeText: {
		color: "#FFFFFF",
		fontSize: 12,
		fontWeight: "500",
		minWidth: 40,
		textAlign: "center",
	},
	timeTextFullscreen: {
		fontSize: 14,
	},

	// Botão de qualidade
	qualityButtonContainer: {
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
	},
	qualityText: {
		color: "#FFFFFF",
		fontSize: 12,
		fontWeight: "500",
	},
	qualityTextFullscreen: {
		fontSize: 14,
	},

	// Modal de qualidade
	modalOverlay: {
		flex: 1,
		backgroundColor: "rgba(0, 0, 0, 0.7)",
		justifyContent: "center",
		alignItems: "center",
		padding: 20,
	},
	qualityModal: {
		backgroundColor: "#1a1a1a",
		borderRadius: 12,
		maxHeight: 400,
		width: "100%",
		maxWidth: 300,
	},
	qualityModalFullscreen: {
		maxWidth: 400,
	},
	qualityHeader: {
		flexDirection: "row",
		justifyContent: "space-between",
		alignItems: "center",
		padding: 16,
		borderBottomWidth: 1,
		borderBottomColor: "rgba(255, 255, 255, 0.1)",
	},
	qualityTitle: {
		color: "#FFFFFF",
		fontSize: 18,
		fontWeight: "600",
	},
	closeButton: {
		padding: 4,
	},
	qualityList: {
		maxHeight: 300,
	},
	qualityOption: {
		flexDirection: "row",
		alignItems: "center",
		justifyContent: "space-between",
		padding: 16,
		borderBottomWidth: 1,
		borderBottomColor: "rgba(255, 255, 255, 0.05)",
	},
	qualityOptionSelected: {
		backgroundColor: "rgba(0, 122, 255, 0.1)",
	},
	qualityOptionContent: {
		flex: 1,
	},
	qualityOptionLabel: {
		color: "#FFFFFF",
		fontSize: 16,
		fontWeight: "500",
	},
	qualityOptionResolution: {
		color: "#999999",
		fontSize: 14,
		marginTop: 2,
	},
	qualityOptionBitrate: {
		color: "#999999",
		fontSize: 12,
		marginTop: 2,
	},

	// Botão de voltar ao vivo
	goToLiveButton: {
		backgroundColor: "#FF3B30",
		flexDirection: "row",
		alignItems: "center",
		gap: 4,
		paddingHorizontal: 8,
	},
	goToLiveText: {
		color: "#FFFFFF",
		fontSize: 10,
		fontWeight: "bold",
	},
	goToLiveTextFullscreen: {
		fontSize: 12,
	},

	// Indicador de status atrasado
	liveStatusIndicator: {
		flexDirection: "row",
		alignItems: "center",
		backgroundColor: "rgba(255, 149, 0, 0.9)",
		paddingHorizontal: 12,
		paddingVertical: 6,
		borderRadius: 16,
		marginTop: 8,
		gap: 4,
	},
	liveStatusText: {
		color: "#FFFFFF",
		fontSize: 12,
		fontWeight: "bold",
	},
});

export default PlayerControls;
