import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Badge, Card, Header, ScreenContainer } from "@/src/components/ui";
import { useTheme } from "@/src/theme";

const ITEMS: { icon: keyof typeof Ionicons.glyphMap; title: string; body: string }[] = [
  {
    icon: "hardware-chip-outline",
    title: "Local AI",
    body: "Models run directly on your device. Your prompts are processed on-device and never sent to a server for inference.",
  },
  {
    icon: "chatbubbles-outline",
    title: "Local chat storage",
    body: "Conversations are stored locally on your device. You stay in control and can delete any chat at any time.",
  },
  {
    icon: "lock-closed-outline",
    title: "Private / end-to-end chat",
    body: "We're building private, end-to-end encrypted sync as an optional feature.",
  },
];

export default function Privacy() {
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScreenContainer testID="privacy-screen">
      <Header title="Privacy & Security" showBack />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingBottom: insets.bottom + spacing.xl,
          gap: spacing.lg,
        }}
      >
        <View style={styles.hero}>
          <View style={[styles.icon, { backgroundColor: colors.card, borderRadius: radius.xxl }]}>
            <Ionicons name="shield-checkmark-outline" size={40} color={colors.text} />
          </View>
          <Text style={[typography.h2, { color: colors.text, marginTop: spacing.md }]}>
            Private by design
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary, textAlign: "center", marginTop: 6 }]}>
            NASUKI keeps your AI on your device — so your data stays yours.
          </Text>
        </View>

        {ITEMS.map((item, i) => (
          <Card key={i}>
            <View style={styles.cardHead}>
              <View style={[styles.cardIcon, { backgroundColor: colors.background, borderRadius: radius.md }]}>
                <Ionicons name={item.icon} size={20} color={colors.text} />
              </View>
              <Text style={[typography.h3, { color: colors.text, flex: 1 }]}>{item.title}</Text>
              {i === 2 && <Badge label="Coming soon" tone="warning" />}
            </View>
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: spacing.sm }]}>
              {item.body}
            </Text>
          </Card>
        ))}

        <Card style={{ backgroundColor: colors.background, borderWidth: 1, borderColor: colors.cardBorder }}>
          <Text style={[typography.small, { color: colors.textSecondary }]}>
            Note: End-to-end encryption is not yet enabled in this build. Security features will be
            implemented and independently verified in a later phase before we make any encryption
            claims.
          </Text>
        </Card>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", paddingTop: 8 },
  icon: { width: 80, height: 80, alignItems: "center", justifyContent: "center" },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  cardIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
});
