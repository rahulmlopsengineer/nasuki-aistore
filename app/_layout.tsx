import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { LogBox, View } from "react-native";
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

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [iconsLoaded, iconError] = useIconFonts();
  const [fontsLoaded, fontError] = useFonts({
    "SpaceGrotesk-Regular": require("../assets/fonts/SpaceGrotesk-Regular.ttf"),
    "SpaceGrotesk-Medium": require("../assets/fonts/SpaceGrotesk-Medium.ttf"),
    "SpaceGrotesk-SemiBold": require("../assets/fonts/SpaceGrotesk-SemiBold.ttf"),
    "SpaceGrotesk-Bold": require("../assets/fonts/SpaceGrotesk-Bold.ttf"),
  });

  const ready = (iconsLoaded || iconError) && (fontsLoaded || fontError);

  const [forceReady, setForceReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setForceReady(true), 200);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (ready || forceReady) SplashScreen.hideAsync().catch(() => {});
  }, [ready, forceReady]);

  if (!ready && !forceReady) {
    return <View style={{ flex: 1, backgroundColor: "#FFFFFF" }} />;
  }

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
