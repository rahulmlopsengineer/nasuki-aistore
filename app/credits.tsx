import { useRouter } from "expo-router";
import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";

import { PROTOTYPE_MODE } from "@/src/constants/config";
import { Header, ScreenContainer } from "@/src/components/ui";
import { useTheme } from "@/src/theme";

export default function Credits() {
  const router = useRouter();
  const { colors, typography, spacing } = useTheme();

  useEffect(() => {
    if (PROTOTYPE_MODE) {
      router.replace("/(tabs)");
    }
  }, [router]);

  return (
    <ScreenContainer testID="credits-screen">
      <Header title="Prototype Mode" showBack />
      <View style={[styles.center, { padding: spacing.xl }]}>
        <Text style={[typography.h3, { color: colors.text, textAlign: "center" }]}>
          Monetization is disabled in Prototype Mode
        </Text>
        <Text style={[typography.body, { color: colors.textSecondary, textAlign: "center", marginTop: 8 }]}>
          All local AI features run offline on-device without credits, ads, or subscriptions.
        </Text>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
});
