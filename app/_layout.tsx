import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { LogBox } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ThemedStatusBar } from "@/src/components/ui";
import { ErrorBoundary } from "@/src/components/error-boundary";
import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider } from "@/src/hooks/use-auth";
import { DatabaseProvider, DatabaseGate } from "@/src/hooks/use-database";
import { ToastProvider } from "@/src/hooks/use-toast";
import { ThemeProvider } from "@/src/theme";

// Disable logbox errors etc so that users can see the app
// and agent works as expected.
LogBox.ignoreAllLogs(true);

// Keep the native splash visible from cold start until icon fonts register.
// Required because @expo/vector-icons' componentDidMount fallback fires
// Font.loadAsync against a broken vendor path if any <Icon> mounts before
// the family is registered — which throws on Android Expo Go.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [iconsLoaded, iconError] = useIconFonts();
  const [fontsLoaded, fontError] = useFonts({
    "SpaceGrotesk-Regular": require("../assets/fonts/SpaceGrotesk-Regular.ttf"),
    "SpaceGrotesk-Medium": require("../assets/fonts/SpaceGrotesk-Medium.ttf"),
    "SpaceGrotesk-SemiBold": require("../assets/fonts/SpaceGrotesk-SemiBold.ttf"),
    "SpaceGrotesk-Bold": require("../assets/fonts/SpaceGrotesk-Bold.ttf"),
  });

  const ready = (iconsLoaded || iconError) && (fontsLoaded || fontError);

  // Failsafe: on some platforms (notably web) useFonts with local TTFs can hang
  // without ever firing an error. Proceed after a short timeout so the app never
  // gets stuck on a blank screen — system fonts are used until custom ones load.
  const [forceReady, setForceReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setForceReady(true), 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (ready || forceReady) SplashScreen.hideAsync();
  }, [ready, forceReady]);

  if (!ready && !forceReady) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <SafeAreaProvider>
          <ErrorBoundary>
            <ThemeProvider initialMode="light">
              <DatabaseProvider>
                <DatabaseGate>
                  <AuthProvider>
                    <ToastProvider>
                      <ThemedStatusBar />
                      <Stack
                        screenOptions={{
                          headerShown: false,
                          contentStyle: { backgroundColor: "#FFFFFF" },
                          animation: "slide_from_right",
                        }}
                      >
                        <Stack.Screen name="index" />
                        <Stack.Screen name="(auth)" />
                        <Stack.Screen name="(tabs)" />
                        <Stack.Screen name="credits" options={{ presentation: "card" }} />
                      </Stack>
                    </ToastProvider>
                  </AuthProvider>
                </DatabaseGate>
              </DatabaseProvider>
            </ThemeProvider>
          </ErrorBoundary>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
