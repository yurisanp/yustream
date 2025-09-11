import { useRef, useCallback, memo, useEffect } from "react";
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
	useMediaQuery,
	useTheme,
	Stack,
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
import { usePlayerDimensions } from "../hooks/usePlayerDimensions";

interface OvenStreamPlayerProps {
	showToast: (message: string, type: "success" | "error" | "info") => void;
	onNavigateToStremio: () => void;
	onNavigateToAdmin: () => void;
}

const OvenStreamPlayer = memo(
	({
		showToast,
		onNavigateToStremio,
		onNavigateToAdmin,
	}: OvenStreamPlayerProps) => {
		const { user, logout, getStreamToken } = useAuth();
		const theme = useTheme();
		const isMobile = useMediaQuery(theme.breakpoints.down("md"));
		const isTablet = useMediaQuery(theme.breakpoints.down("lg"));
		const playerDimensions = usePlayerDimensions();

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
			onError: (
				error: string | Error | { message?: string; code?: number }
			) => {
				console.error("Player error:", error);
				let errorMessage: string;

				if (error instanceof Error) {
					errorMessage = error.message;
				} else if (typeof error === "string") {
					errorMessage = error;
				} else {
					errorMessage = error.message || "Erro desconhecido";
				}

				showToastRef.current(`Erro no player: ${errorMessage}`, "error");
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

		const getStatusColor = ():
			| "info"
			| "success"
			| "warning"
			| "error"
			| "default" => {
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
			onNavigateToAdmin();
		};

		const handleStremioConfig = () => {
			onNavigateToStremio();
		};

		return (
			<Box
				ref={playerContainerRef}
				sx={{ minHeight: "100vh", bgcolor: "background.default" }}
			>
				{/* Header responsivo com informações do usuário */}
				<AppBar
					position="static"
					elevation={0}
					sx={{
						bgcolor: "background.paper",
						borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
					}}
				>
					<Toolbar
						sx={{
							px: { xs: 1, sm: 2, md: 3 },
							minHeight: { xs: 56, sm: 64 },
							flexWrap: { xs: "wrap", sm: "nowrap" },
						}}
					>
						{/* Informações do usuário - sempre visível */}
						<Box
							sx={{
								flexGrow: 1,
								display: "flex",
								alignItems: "center",
								gap: { xs: 1, sm: 2 },
								minWidth: 0,
								flexWrap: { xs: "wrap", sm: "nowrap" },
							}}
						>
							<Typography
								variant={isMobile ? "body1" : "h6"}
								component="div"
								color="text.primary"
								sx={{
									fontWeight: 600,
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
									flexShrink: 0,
								}}
							>
								{isMobile ? user?.username : `Bem-vindo, ${user?.username}`}
							</Typography>

							{/* Chips de status - responsivos */}
							<Stack
								direction={{ xs: "column", sm: "row" }}
								spacing={{ xs: 0.5, sm: 1 }}
								sx={{
									alignItems: { xs: "flex-start", sm: "center" },
									flexWrap: "wrap",
								}}
							>
								<Chip
									label={user?.role}
									size="small"
									color="primary"
									variant="outlined"
									sx={{ fontSize: { xs: "0.7rem", sm: "0.75rem" } }}
								/>

								{!isMobile && (
									<Chip
										icon={getStatusIcon()}
										label={getStatusText()}
										color={getStatusColor()}
										size="small"
										variant="filled"
									/>
								)}

								{/* Status da Stream - sempre visível */}
								<Chip
									icon={
										streamStatus.isOnline ? (
											<Wifi color="success" />
										) : (
											<WifiOff color="error" />
										)
									}
									label={
										isMobile
											? streamStatus.isOnline
												? "Online"
												: "Offline"
											: streamStatus.isOnline
											? "Stream Online"
											: "Stream Offline"
									}
									color={streamStatus.isOnline ? "success" : "error"}
									size="small"
									variant="outlined"
									sx={{ fontSize: { xs: "0.7rem", sm: "0.75rem" } }}
								/>

								{streamStatus.isLoading && (
									<Chip
										icon={<CircularProgress size={16} color="primary" />}
										label={isMobile ? "..." : "Verificando..."}
										color="info"
										size="small"
										variant="outlined"
										sx={{ fontSize: { xs: "0.7rem", sm: "0.75rem" } }}
									/>
								)}
							</Stack>
						</Box>

						{/* Ações - responsivas */}
						<Box
							sx={{
								display: "flex",
								gap: { xs: 0.5, sm: 1 },
								alignItems: "center",
								flexShrink: 0,
							}}
						>
							{/* Desktop/Tablet: botões completos */}
							{!isMobile && (
								<>
									<Button
										variant="outlined"
										startIcon={<PlayArrow />}
										onClick={handleStremioConfig}
										size={isTablet ? "small" : "medium"}
										sx={{
											color: "text.primary",
											borderColor: "rgba(255, 255, 255, 0.3)",
											fontSize: { sm: "0.875rem", md: "0.9rem" },
										}}
									>
										Stremio
									</Button>
									{user?.role === "admin" && (
										<Button
											variant="outlined"
											startIcon={<Settings />}
											onClick={handleAdminPanel}
											size={isTablet ? "small" : "medium"}
											sx={{
												color: "text.primary",
												borderColor: "rgba(255, 255, 255, 0.3)",
												fontSize: { sm: "0.875rem", md: "0.9rem" },
											}}
										>
											Admin
										</Button>
									)}
								</>
							)}

							{/* Mobile: menu hambúrguer */}
							{isMobile && (
								<>
									<IconButton
										onClick={handleStremioConfig}
										sx={{ color: "text.primary" }}
										size="small"
									>
										<PlayArrow />
									</IconButton>
									{user?.role === "admin" && (
										<IconButton
											onClick={handleAdminPanel}
											sx={{ color: "text.primary" }}
											size="small"
										>
											<Settings />
										</IconButton>
									)}
								</>
							)}

							{/* Logout - sempre visível */}
							<IconButton
								color="inherit"
								onClick={handleLogout}
								sx={{ color: "text.primary" }}
								size={isMobile ? "small" : "medium"}
							>
								<Logout />
							</IconButton>
						</Box>
					</Toolbar>
				</AppBar>

				{/* Container do OvenPlayer - com dimensões calculadas para aspect ratio 16:9 */}
				<Box
					id="ovenPlayerContainer"
					className="oven-player-container"
					sx={{
						width:
							playerDimensions.width > 0
								? `${playerDimensions.width}px`
								: "100%",
						maxWidth: `${playerDimensions.maxWidth}px`,
						height:
							playerDimensions.height > 0
								? `${playerDimensions.height}px`
								: {
										xs: "calc(100vh - 56px)", // Mobile: altura da toolbar menor
										sm: "calc(100vh - 64px)", // Desktop: altura padrão
								  },
						position: "relative",
						overflow: "hidden",
						margin: "0 auto", // Centralizar o player
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						"& .oven-player": {
							width: "100%",
							height: "100%",
							maxWidth: "100%",
						},
						"& video": {
							objectFit: "contain",
							width: "100%",
							height: "100%",
							maxWidth: "100%",
						},
					}}
				>
					<Box id="ovenPlayer" />
				</Box>

				{/* Stream Offline Banner - Responsivo */}
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
							width: { xs: "90%", sm: "80%", md: "60%", lg: "50%" },
							maxWidth: 500,
						}}
					>
						<Paper
							elevation={8}
							sx={{
								p: { xs: 2, sm: 3, md: 4 },
								bgcolor: "background.paper",
								border: "1px solid rgba(255, 255, 255, 0.1)",
								borderRadius: 2,
								opacity: 0.9,
								backdropFilter: "blur(10px)",
							}}
						>
							<Box sx={{ mb: { xs: 1.5, sm: 2 } }}>
								<ErrorOutline
									color="warning"
									sx={{
										fontSize: { xs: 40, sm: 48, md: 56 },
										display: "block",
										mx: "auto",
									}}
								/>
							</Box>
							<Typography
								variant={isMobile ? "h6" : "h5"}
								color="text.primary"
								gutterBottom
								sx={{ fontWeight: 600 }}
							>
								Stream Offline
							</Typography>
							<Typography
								variant="body2"
								color="text.secondary"
								sx={{
									mb: 2,
									fontSize: { xs: "0.875rem", sm: "0.9rem" },
								}}
							>
								A stream não está disponível no momento
							</Typography>

							{/* Informações de status - responsivas */}
							<Box
								sx={{
									mb: 2,
									display: "flex",
									flexDirection: "column",
									gap: 0.5,
									alignItems: "center",
								}}
							>
								{!streamStatus.isOnline && (
									<Typography
										variant="body2"
										color="error.main"
										sx={{ fontSize: { xs: "0.8rem", sm: "0.875rem" } }}
									>
										Status da Stream: Offline
									</Typography>
								)}
								{streamStatus.error && (
									<Typography
										variant="body2"
										color="error.main"
										sx={{
											fontSize: { xs: "0.8rem", sm: "0.875rem" },
											wordBreak: "break-word",
											textAlign: "center",
										}}
									>
										Erro: {streamStatus.error}
									</Typography>
								)}
								{streamStatus.lastChecked && (
									<Typography
										variant="body2"
										color="text.secondary"
										sx={{ fontSize: { xs: "0.8rem", sm: "0.875rem" } }}
									>
										Última verificação:{" "}
										{streamStatus.lastChecked.toLocaleTimeString()}
									</Typography>
								)}
								{retryCount < MAX_RETRY_ATTEMPTS ? (
									<Typography
										variant="body2"
										color="text.secondary"
										sx={{ fontSize: { xs: "0.8rem", sm: "0.875rem" } }}
									>
										Tentativas automáticas: {retryCount}/{MAX_RETRY_ATTEMPTS}
									</Typography>
								) : (
									<Typography
										variant="body2"
										color="text.secondary"
										sx={{ fontSize: { xs: "0.8rem", sm: "0.875rem" } }}
									>
										Tentativas automáticas esgotadas
									</Typography>
								)}
							</Box>

							<Button
								variant="contained"
								startIcon={<Refresh />}
								onClick={handleManualRetry}
								size={isMobile ? "small" : "medium"}
								sx={{
									pointerEvents: "auto", // Permite cliques no botão
									mt: 1,
									px: { xs: 2, sm: 3 },
									py: { xs: 1, sm: 1.5 },
									fontSize: { xs: "0.875rem", sm: "0.9rem" },
								}}
							>
								Tentar Novamente
							</Button>
						</Paper>
					</Box>
				)}

				{/* Loading/Status Overlay - Responsivo */}
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
							p: { xs: 2, sm: 3 },
						}}
					>
						<Paper
							elevation={8}
							sx={{
								p: { xs: 3, sm: 4, md: 5 },
								bgcolor: "background.paper",
								border: "1px solid rgba(255, 255, 255, 0.1)",
								borderRadius: 2,
								textAlign: "center",
								width: { xs: "100%", sm: "auto" },
								maxWidth: { xs: "100%", sm: 400, md: 500 },
								minWidth: { xs: 280, sm: 300 },
							}}
						>
							<Box
								sx={{
									mb: { xs: 2, sm: 3 },
									display: "flex",
									justifyContent: "center",
								}}
							>
								{getStatusIcon()}
							</Box>
							<Typography
								variant={isMobile ? "h6" : "h5"}
								color="text.primary"
								gutterBottom
								sx={{
									fontWeight: 600,
									fontSize: { xs: "1.1rem", sm: "1.25rem", md: "1.5rem" },
								}}
							>
								{getStatusText()}
							</Typography>
							{status === "error" && (
								<Button
									variant="contained"
									startIcon={<Refresh />}
									onClick={handleManualRetry}
									size={isMobile ? "small" : "medium"}
									sx={{
										mt: { xs: 2, sm: 3 },
										px: { xs: 2, sm: 3 },
										py: { xs: 1, sm: 1.5 },
										fontSize: { xs: "0.875rem", sm: "0.9rem" },
									}}
								>
									Tentar Novamente
								</Button>
							)}
						</Paper>
					</Box>
				)}
			</Box>
		);
	}
);

OvenStreamPlayer.displayName = "YuStream";

export default OvenStreamPlayer;
