import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, StyleProp, StyleSheet, Text, View, ViewStyle } from "react-native";

import { useTheme } from "@/src/theme";
import { Touchable } from "./Touchable";

export type ButtonVariant = "accent" | "solid" | "outline" | "ghost";
export type ButtonSize = "sm" | "md" | "lg";

type Props = {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  testID?: string;
  style?: StyleProp<ViewStyle>;
};

const HEIGHT: Record<ButtonSize, number> = { sm: 40, md: 48, lg: 56 };

export const Button: React.FC<Props> = ({
  label,
  onPress,
  variant = "accent",
  size = "md",
  loading = false,
  disabled = false,
  fullWidth = true,
  icon,
  testID,
  style,
}) => {
  const { colors, radius, typography, shadows } = useTheme();

  const bg: Record<ButtonVariant, string> = {
    accent: colors.accentSoft,
    solid: colors.text,
    outline: "transparent",
    ghost: "transparent",
  };
  const fg: Record<ButtonVariant, string> = {
    accent: colors.accentOn,
    solid: colors.textInverse,
    outline: colors.text,
    ghost: colors.text,
  };

  return (
    <Touchable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.base,
        {
          height: HEIGHT[size],
          backgroundColor: bg[variant],
          borderRadius: radius.md,
          borderWidth: variant === "outline" ? 1.5 : 0,
          borderColor: colors.cardBorder,
          alignSelf: fullWidth ? "stretch" : "flex-start",
          paddingHorizontal: fullWidth ? 20 : 24,
        },
        variant === "accent" ? shadows.sm : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg[variant]} />
      ) : (
        <View style={styles.row}>
          {icon && <Ionicons name={icon} size={18} color={fg[variant]} />}
          <Text style={[typography.button, { color: fg[variant] }]}>{label}</Text>
        </View>
      )}
    </Touchable>
  );
};

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
});
