import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, StyleProp, StyleSheet, ViewStyle } from "react-native";

import { useTheme } from "@/src/theme";
import { Touchable } from "./Touchable";

export type IconButtonVariant = "circle" | "solid" | "ghost" | "accent";

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  size?: number;
  variant?: IconButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  color?: string;
  accessibilityLabel: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

export const IconButton: React.FC<Props> = ({
  icon,
  onPress,
  size = 52,
  variant = "circle",
  loading = false,
  disabled = false,
  color,
  accessibilityLabel,
  testID,
  style,
}) => {
  const { colors, shadows } = useTheme();

  const bg: Record<IconButtonVariant, string> = {
    circle: colors.circle,
    solid: colors.text,
    ghost: "transparent",
    accent: colors.accentSoft,
  };
  const fg: Record<IconButtonVariant, string> = {
    circle: colors.circleIcon,
    solid: colors.textInverse,
    ghost: colors.text,
    accent: colors.accentOn,
  };

  return (
    <Touchable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      scaleTo={0.9}
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg[variant],
        },
        variant === "circle" || variant === "solid" ? shadows.sm : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={color ?? fg[variant]} />
      ) : (
        <Ionicons name={icon} size={size * 0.42} color={color ?? fg[variant]} />
      )}
    </Touchable>
  );
};

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center" },
});
