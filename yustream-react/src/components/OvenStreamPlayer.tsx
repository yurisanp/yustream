import { useState, useRef, useCallback, memo, useEffect } from "react";
import {
	Box,
	AppBar,
	Toolbar,
	Typography,
	Button,
	IconButton,
	Chip,
	CircularProgress,
	Paper,
} from "@mui/material";
import {
	Wifi,
	WifiOff,
	ErrorOutline,
	Logout,
	Settings,
	PlayArrow,
	Refresh,
} from "@mui/icons-material";
import { useAuth } from "../contexts/AuthContext";
import { useStreamPlayer } from "../hooks/useStreamPlayer";
import AdminScreen from "./AdminScreen";
import StremioConfig from "./StremioConfig";

interface OvenStreamPlayerProps {
	showToast: (message: string, type: "success" | "error" | "info") => void;
}

const OvenStreamPlayer = memo(({ showToast }: OvenStreamPlayerProps) => {
	const { user, logout, getStreamToken } = useAuth();

	// Estados principais
	const [showAdminScreen, setShowAdminScreen] = useState<boolean>(false);
	const [showStremioConfig, setShowStremioConfig] = useState<boolean>(false);

	// Refs
	const showToastRef = useRef(showToast);

	// Atualizar ref sempre que showToast mudar
	useEffect(() => {
		showToastRef.current = showToast;
	}, [showToast]);

	// Callback para mudanças no status da stream
	const handleStreamOnlineChange = useCallback((isOnline: boolean) => {
		if (isOnline) {
			showToastRef.current("Stream está online", "success");
		} else {
			showToastRef.current("Stream está offline", "info");
		}
	}, []);

	// Hook do player com validação de stream
	const {
		status,
		retryCount,
		playerContainerRef,
		handleManualRetry,
		MAX_RETRY_ATTEMPTS,
		streamStatus,
	} = useStreamPlayer({
		onStatusChange: (newStatus: string) => {
			console.log("Player status changed:", newStatus);
		},
		onError: (error: any) => {
			console.error("Player error:", error);
			showToastRef.current(`Erro no player: ${error}`, "error");
		},
		onStreamOnlineChange: handleStreamOnlineChange,
		getStreamToken,
	});

	// Funções de callback para ações do usuário

	const getStatusIcon = () => {
		switch (status) {
			case "connecting":
				return <CircularProgress size={24} color="primary" />;
			case "playing":
				return <Wifi color="success" />;
			case "offline":
				return <ErrorOutline color="warning" />;
			case "error":
				return <WifiOff color="error" />;
			default:
				return <Wifi color="action" />;
		}
	};

	const getStatusText = () => {
		switch (status) {
			case "connecting":
				return "Conectando à stream...";
			case "playing":
				return "Stream ao vivo";
			case "offline":
				return "Stream offline";
			case "error":
				return "Erro na conexão";
			default:
				return "Status desconhecido";
		}
	};

	const getStatusColor = () => {
		switch (status) {
			case "connecting":
				return "info";
			case "playing":
				return "success";
			case "offline":
				return "warning";
			case "error":
				return "error";
			default:
				return "default";
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

	return (
		<Box
			ref={playerContainerRef}
			sx={{ minHeight: "100vh", bgcolor: "background.default" }}
		>
			{/* Header com informações do usuário */}
			<AppBar
				position="static"
				elevation={0}
				sx={{
					bgcolor: "background.paper",
					borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
				}}
			>
				<Toolbar>
					<Box
						sx={{ flexGrow: 1, display: "flex", alignItems: "center", gap: 2 }}
					>
						<Typography variant="h6" component="div" color="text.primary">
							Bem-vindo, {user?.username}
						</Typography>
						<Chip
							label={user?.role}
							size="small"
							color="primary"
							variant="outlined"
						/>
						<Chip
							icon={getStatusIcon()}
							label={getStatusText()}
							color={getStatusColor() as any}
							size="small"
							variant="filled"
						/>
						{/* Status da Stream */}
						<Chip
							icon={
								streamStatus.isOnline ? (
									<Wifi color="success" />
								) : (
									<WifiOff color="error" />
								)
							}
							label={streamStatus.isOnline ? "Stream Online" : "Stream Offline"}
							color={streamStatus.isOnline ? "success" : "error"}
							size="small"
							variant="outlined"
						/>
						{streamStatus.isLoading && (
							<Chip
								icon={<CircularProgress size={16} color="primary" />}
								label="Verificando..."
								color="info"
								size="small"
								variant="outlined"
							/>
						)}
					</Box>
					<Box sx={{ display: "flex", gap: 1 }}>
						<Button
							variant="outlined"
							startIcon={<PlayArrow />}
							onClick={handleStremioConfig}
							sx={{
								color: "text.primary",
								borderColor: "rgba(255, 255, 255, 0.3)",
							}}
						>
							Stremio
						</Button>
						{user?.role === "admin" && (
							<Button
								variant="outlined"
								startIcon={<Settings />}
								onClick={handleAdminPanel}
								sx={{
									color: "text.primary",
									borderColor: "rgba(255, 255, 255, 0.3)",
								}}
							>
								Admin
							</Button>
						)}
						<IconButton
							color="inherit"
							onClick={handleLogout}
							sx={{ color: "text.primary" }}
						>
							<Logout />
						</IconButton>
					</Box>
				</Toolbar>
			</AppBar>

			{/* Container do OvenPlayer */}
			<Box
				id="ovenPlayer"
				sx={{
					width: "100%",
					height: "calc(100vh - 64px)",
					position: "relative",
					"& .oven-player": {
						width: "100%",
						height: "100%",
					},
				}}
			/>

			{/* Stream Offline Banner - Não bloqueia a interface */}
			{status === "offline" && (
				<Box
					sx={{
						position: "absolute",
						top: "50%",
						left: "50%",
						transform: "translate(-50%, -50%)",
						zIndex: 1000,
						textAlign: "center",
						pointerEvents: "none", // Permite cliques através do banner
					}}
				>
					<Paper
						elevation={8}
						sx={{
							p: 3,
							bgcolor: "background.paper",
							border: "1px solid rgba(255, 255, 255, 0.1)",
							borderRadius: 2,
							opacity: 0.9,
							backdropFilter: "blur(10px)",
						}}
					>
						<Box sx={{ mb: 2 }}>
							<ErrorOutline color="warning" sx={{ fontSize: 48 }} />
						</Box>
						<Typography variant="h6" color="text.primary" gutterBottom>
							Stream Offline
						</Typography>
						<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
							A stream não está disponível no momento
						</Typography>
						{!streamStatus.isOnline && (
							<Typography variant="body2" color="error.main" sx={{ mb: 1 }}>
								Status da Stream: Offline
							</Typography>
						)}
						{streamStatus.error && (
							<Typography variant="body2" color="error.main" sx={{ mb: 1 }}>
								Erro: {streamStatus.error}
							</Typography>
						)}
						{streamStatus.lastChecked && (
							<Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
								Última verificação:{" "}
								{streamStatus.lastChecked.toLocaleTimeString()}
							</Typography>
						)}
						{retryCount < MAX_RETRY_ATTEMPTS ? (
							<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
								Tentativas automáticas: {retryCount}/{MAX_RETRY_ATTEMPTS}
							</Typography>
						) : (
							<Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
								Tentativas automáticas esgotadas
							</Typography>
						)}
						<Button
							variant="contained"
							startIcon={<Refresh />}
							onClick={handleManualRetry}
							sx={{
								pointerEvents: "auto", // Permite cliques no botão
								mt: 1,
							}}
						>
							Tentar Novamente
						</Button>
					</Paper>
				</Box>
			)}

			{/* Loading/Status Overlay */}
			{(status === "connecting" || status === "error") && (
				<Box
					sx={{
						position: "fixed",
						top: 0,
						left: 0,
						right: 0,
						bottom: 0,
						backgroundColor: "rgba(0, 0, 0, 0.8)",
						zIndex: 1300,
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					<Paper
						elevation={8}
						sx={{
							p: 4,
							bgcolor: "background.paper",
							border: "1px solid rgba(255, 255, 255, 0.1)",
							borderRadius: 2,
							textAlign: "center",
							minWidth: 300,
						}}
					>
						<Box sx={{ mb: 2 }}>{getStatusIcon()}</Box>
						<Typography variant="h6" color="text.primary" gutterBottom>
							{getStatusText()}
						</Typography>
						{status === "error" && (
							<Button
								variant="contained"
								startIcon={<Refresh />}
								onClick={handleManualRetry}
								sx={{ mt: 2 }}
							>
								Tentar Novamente
							</Button>
						)}
					</Paper>
				</Box>
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
		</Box>
	);
});

OvenStreamPlayer.displayName = "YuStream";

export default OvenStreamPlayer;
