import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInUp } from "react-native-reanimated";

import { Logo } from "@/src/components/ui";
import { useAuth } from "@/src/hooks/use-auth";
import { APP } from "@/src/constants/config";
import { useTheme } from "@/src/theme";

export default function Splash() {
  const { colors, fonts, typography, spacing } = useTheme();
  const router = useRouter();
  const { initializing, user, onboardingComplete } = useAuth();

  useEffect(() => {
    if (initializing) return;
    const t = setTimeout(() => {
      if (!onboardingComplete) router.replace("/(auth)/onboarding");
      else if (!user) router.replace("/(auth)/login");
      else router.replace("/(tabs)");
    }, 1400);
    return () => clearTimeout(t);
  }, [initializing, user, onboardingComplete, router]);

  return (
    <View testID="splash-screen" style={[styles.root, { backgroundColor: colors.background }]}>
      <Animated.View entering={FadeIn.duration(500)} style={styles.center}>
        <Logo size={128} />
        <Text
          style={[
            styles.wordmark,
            { color: colors.text, fontFamily: fonts.bold, marginTop: spacing.xl },
          ]}
        >
          {APP.name}
        </Text>
        <View style={styles.taglineRow}>
          <View style={[styles.dash, { backgroundColor: colors.text }]} />
          <Text style={[styles.tagline, { color: colors.text, fontFamily: fonts.medium }]}>
            {APP.tagline}
          </Text>
          <View style={[styles.dash, { backgroundColor: colors.text }]} />
        </View>
      </Animated.View>

      <Animated.Text
        entering={FadeInUp.delay(400).duration(500)}
        style={[typography.small, styles.version, { color: colors.textSecondary }]}
      >
        Version {APP.version}
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center" },
  center: { alignItems: "center" },
  wordmark: { fontSize: 44, letterSpacing: 8 },
  taglineRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  dash: { width: 22, height: 2, borderRadius: 1 },
  tagline: { fontSize: 12, letterSpacing: 4 },
  version: { position: "absolute", bottom: 48 },
});
