import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Logo, ScreenContainer, Touchable } from "@/src/components/ui";
import { APP, AUTH } from "@/src/constants/config";
import { useAuth } from "@/src/hooks/use-auth";
import { useToast } from "@/src/hooks/use-toast";
import { useTheme } from "@/src/theme";

export default function Login() {
  const { colors, fonts, radius, spacing, typography, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signInWithGoogle, signInWithDemo } = useAuth();
  const toast = useToast();
  const [busy, setBusy] = useState<null | "google" | "demo">(null);

  const run = async (which: "google" | "demo") => {
    if (busy) return;
    setBusy(which);
    try {
      if (which === "google") await signInWithGoogle();
      else await signInWithDemo();
      router.replace("/(tabs)");
    } catch {
      toast.show("Sign in failed. Please try again.", "error");
      setBusy(null);
    }
  };

  return (
    <ScreenContainer testID="login-screen">
      <View style={[styles.root, { paddingHorizontal: spacing.xl }]}>
        <Animated.View entering={FadeInDown.duration(400)} style={styles.brand}>
          <Logo size={64} />
          <Text style={[styles.wordmark, { color: colors.text, fontFamily: fonts.bold }]}>
            {APP.name}
          </Text>
          <Text style={[styles.tagline, { color: colors.textSecondary, fontFamily: fonts.medium }]}>
            {APP.tagline}
          </Text>
        </Animated.View>

        <View style={styles.middle}>
          <Text style={[typography.body, { color: colors.textSecondary, textAlign: "center" }]}>
            login using following social accounts
          </Text>

          <Touchable
            testID="login-google-button"
            onPress={() => run("google")}
            disabled={busy !== null}
            style={[
              styles.googleBtn,
              shadows.sm,
              { backgroundColor: colors.accentSoft, borderRadius: radius.md, marginTop: spacing.x3l },
            ]}
            accessibilityLabel="Continue with Google"
          >
            <Ionicons name="logo-google" size={20} color={colors.accentOn} />
            <Text
              style={[
                typography.button,
                { color: colors.accentOn, letterSpacing: 3 },
              ]}
            >
              {busy === "google" ? "SIGNING IN…" : "GOOGLE"}
            </Text>
          </Touchable>

          <Touchable
            testID="login-demo-button"
            onPress={() => run("demo")}
            disabled={busy !== null || !AUTH.devAuthEnabled}
            haptic={false}
            style={{
              marginTop: spacing.lg,
              alignSelf: "center",
              opacity: AUTH.devAuthEnabled ? 1 : 0,
            }}
            accessibilityLabel="Continue as demo"
          >
            <Text style={[typography.bodyStrong, { color: colors.textSecondary }]}>
              {busy === "demo" ? "Loading…" : "Continue as demo (dev)"}
            </Text>
          </Touchable>
        </View>

        <Text
          style={[
            typography.caption,
            styles.legal,
            { color: colors.textTertiary, paddingBottom: insets.bottom + spacing.lg },
          ]}
        >
          By continuing you agree to our Terms & Privacy Policy.
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  brand: { alignItems: "center", flex: 1, justifyContent: "flex-end", paddingBottom: 24 },
  wordmark: { fontSize: 30, letterSpacing: 5, marginTop: 14 },
  tagline: { fontSize: 11, letterSpacing: 4, marginTop: 4 },
  middle: { flex: 1, justifyContent: "flex-start", paddingTop: 8 },
  googleBtn: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  legal: { textAlign: "center" },
});
