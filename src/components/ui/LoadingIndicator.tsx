import React from "react";
import { ActivityIndicator, StyleSheet, Text, View, ViewStyle } from "react-native";

import { useTheme } from "@/src/theme";

type Props = {
  label?: string;
  fullscreen?: boolean;
  style?: ViewStyle;
  testID?: string;
};

export const LoadingIndicator: React.FC<Props> = ({
  label,
  fullscreen = false,
  style,
  testID,
}) => {
  const { colors, typography, spacing } = useTheme();
  return (
    <View
      testID={testID ?? "loading-indicator"}
      style={[fullscreen && styles.fullscreen, styles.center, style]}
    >
      <ActivityIndicator size="large" color={colors.accent} />
      {!!label && (
        <Text style={[typography.small, { color: colors.textSecondary, marginTop: spacing.md }]}>
          {label}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", padding: 24 },
  fullscreen: { flex: 1 },
});
