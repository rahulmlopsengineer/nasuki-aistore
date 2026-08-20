import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";

import { useTheme } from "@/src/theme";

export type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger" | "info";

type Props = {
  label: string;
  tone?: BadgeTone;
  icon?: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
};

export const Badge: React.FC<Props> = ({ label, tone = "neutral", icon, style, testID }) => {
  const { colors, radius, typography } = useTheme();

  const map: Record<BadgeTone, { bg: string; fg: string }> = {
    neutral: { bg: colors.card, fg: colors.textSecondary },
    accent: { bg: colors.accentSoft, fg: colors.accentOn },
    success: { bg: "rgba(59,178,115,0.15)", fg: colors.success },
    warning: { bg: "rgba(226,166,74,0.15)", fg: colors.warning },
    danger: { bg: "rgba(226,74,74,0.14)", fg: colors.danger },
    info: { bg: "rgba(79,134,230,0.14)", fg: colors.info },
  };
  const c = map[tone];

  return (
    <View
      testID={testID}
      style={[styles.wrap, { backgroundColor: c.bg, borderRadius: radius.pill }, style]}
    >
      {icon}
      <Text style={[typography.label, { color: c.fg }]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: "flex-start",
  },
});
