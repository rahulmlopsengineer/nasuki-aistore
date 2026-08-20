import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";

import { useTheme } from "@/src/theme";
import { Touchable } from "./Touchable";

type Props = {
  title: string;
  centered?: boolean;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
};

export const SectionHeader: React.FC<Props> = ({
  title,
  centered = false,
  actionLabel,
  onAction,
  style,
}) => {
  const { colors, typography } = useTheme();
  return (
    <View style={[styles.wrap, { justifyContent: centered ? "center" : "space-between" }, style]}>
      <Text style={[typography.h2, { color: colors.text, textAlign: centered ? "center" : "left" }]}>
        {title}
      </Text>
      {actionLabel && onAction && !centered && (
        <Touchable onPress={onAction} haptic={false} scaleTo={0.95} accessibilityRole="button">
          <Text style={[typography.bodyStrong, { color: colors.accent }]}>{actionLabel}</Text>
        </Touchable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center" },
});
