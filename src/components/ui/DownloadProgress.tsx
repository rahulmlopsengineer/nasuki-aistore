import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";

import { useTheme } from "@/src/theme";
import { ProgressBar } from "./ProgressBar";

type Props = {
  progress: number; // 0..1
  label?: string;
  style?: ViewStyle;
  testID?: string;
};

// Composed download progress: rainbow bar + percentage + status label.
export const DownloadProgress: React.FC<Props> = ({
  progress,
  label = "Downloading…",
  style,
  testID,
}) => {
  const { colors, typography, spacing } = useTheme();
  const pct = Math.round(Math.max(0, Math.min(1, progress)) * 100);

  return (
    <View testID={testID} style={style}>
      <View style={[styles.row, { marginBottom: spacing.sm }]}>
        <Text style={[typography.small, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[typography.label, { color: colors.text }]}>{pct}%</Text>
      </View>
      <ProgressBar progress={progress} gradient height={8} />
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});
