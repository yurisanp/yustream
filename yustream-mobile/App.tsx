import React, { memo, useCallback, useEffect, useState } from "react";
import {
	View,
	StyleSheet,
	StatusBar,
	Platform,
	AppState,
	AppStateStatus,
} from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import StreamPlayer from "./src/components/StreamPlayer";
import LoginScreen from "./src/components/LoginScreen";
import Toast from "./src/components/Toast";
import { useToast } from "./src/hooks/useToast";
import { AuthProvider, useAuth } from "./src/contexts/AuthContext";
import { StreamStatus } from "./src/types";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// Prevenir que a splash screen seja escondida automaticamente
SplashScreen.preventAutoHideAsync();

// Componente interno que usa o contexto de autenticação
const AppContent = memo(() => {
	const [isAppReady, setIsAppReady] = useState(false);
	const {
		isAuthenticated,
		isLoading: authLoading,
		user,
		getStreamToken,
	} = useAuth();

	const { toasts, hideToast, showSuccess, showError, showInfo } = useToast();

	// Esconder splash screen quando o app estiver pronto
	useEffect(() => {
		const hideSplashScreen = async () => {
			if (isAppReady && !authLoading) {
				await SplashScreen.hideAsync();
			}
		};

		hideSplashScreen();
	}, [isAppReady, authLoading]);

	// Marcar app como pronto após a verificação de auth
	useEffect(() => {
		if (!authLoading) {
			setIsAppReady(true);
		}
	}, [authLoading]);

	// Handlers para o StreamPlayer
	const handleStatusChange = useCallback(
		(status: StreamStatus) => {
			console.log("[App] Status do player mudou:", status);

			switch (status) {
				case "playing":
					showSuccess("Stream conectada com sucesso");
					break;
				case "error":
					showError("Erro na conexão com a stream");
					break;
				case "offline":
					showInfo("Stream está offline");
					break;
			}
		},
		[showSuccess, showError, showInfo]
	);

	const handlePlayerError = useCallback(
		(error: string | Error) => {
			console.error("[App] Erro no player:", error);
			const errorMessage = error instanceof Error ? error.message : error;
			showError(`Erro no player: ${errorMessage}`);
		},
		[showError]
	);

	const handleStreamOnlineChange = useCallback(
		(isOnline: boolean) => {
			console.log(
				"[App] Status da stream mudou:",
				isOnline ? "ONLINE" : "OFFLINE"
			);

			if (isOnline) {
				showSuccess("Stream está online");
			} else {
				showInfo("Stream foi desconectada");
			}
		},
		[showSuccess, showInfo]
	);

	// Handler para sucesso no login
	const handleLoginSuccess = useCallback(() => {
		console.log("[App] Login realizado com sucesso");
		showSuccess(`Bem-vindo, ${user?.username || "usuário"}!`);
	}, [showSuccess, user]);

	// Gerenciar mudanças no estado do app
	useEffect(() => {
		const handleAppStateChange = (nextAppState: AppStateStatus) => {
			console.log("[App] Estado do app mudou:", nextAppState);

			if (nextAppState === "active") {
				console.log("[App] App voltou para foreground");
			} else if (nextAppState === "background") {
				console.log("[App] App foi para background");
			}
		};

		const subscription = AppState.addEventListener(
			"change",
			handleAppStateChange
		);

		return () => subscription?.remove();
	}, []);

	// Não renderizar nada até o app estar pronto
	if (!isAppReady || authLoading) {
		return null; // A splash screen ficará visível
	}

	// Renderizar com ou sem SafeAreaProvider baseado na plataforma
	const renderContent = () => (
		<GestureHandlerRootView style={{ flex: 1 }}>
			<View style={styles.container}>
					{/* Status Bar */}
					<StatusBar
						barStyle="light-content"
						backgroundColor="#000000"
						translucent={Platform.OS === "android"}
					/>

					{/* Conteúdo Principal */}
					{isAuthenticated ? (
						<StreamPlayer
							style={styles.player}
							onStatusChange={handleStatusChange}
							onError={handlePlayerError}
							onStreamOnlineChange={handleStreamOnlineChange}
							getStreamToken={getStreamToken}
							showControls={true}
							showStatusBar={true}
						/>
					) : (
						<LoginScreen onLoginSuccess={handleLoginSuccess} />
					)}

					{/* Toasts */}
					{toasts.map((toast) => (
						<Toast
							key={toast.id}
							{...toast}
							onHide={() => hideToast(toast.id)}
						/>
					))}
			</View>
		</GestureHandlerRootView>
	);

	// No web, não usar SafeAreaProvider para evitar espaçamentos desnecessários
	if (Platform.OS === 'web') {
		return renderContent();
	}

	// No mobile, usar SafeAreaProvider
	return (
		<SafeAreaProvider>
			{renderContent()}
		</SafeAreaProvider>
	);
});

AppContent.displayName = "AppContent";

// Componente principal com Provider
const App = memo(() => {
	return (
		<AuthProvider>
			<AppContent />
		</AuthProvider>
	);
});

const styles = StyleSheet.create({
	container: {
		flex: 1,
		backgroundColor: "#000000",
	},
	player: {
		flex: 1,
	},
});

App.displayName = "YuStreamMobile";

export default App;
