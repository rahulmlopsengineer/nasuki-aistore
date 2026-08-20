import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from "react-native";

import { useTheme } from "@/src/theme";

type Props = TextInputProps & {
  label?: string;
  error?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  containerStyle?: ViewStyle;
  testID?: string;
};

export const Input: React.FC<Props> = ({
  label,
  error,
  icon,
  containerStyle,
  testID,
  style,
  ...rest
}) => {
  const { colors, radius, spacing, typography } = useTheme();
  const [focused, setFocused] = useState(false);

  return (
    <View style={containerStyle}>
      {label && (
        <Text style={[typography.label, styles.label, { color: colors.textSecondary }]}>
          {label}
        </Text>
      )}
      <View
        style={[
          styles.field,
          {
            backgroundColor: colors.card,
            borderRadius: radius.md,
            borderColor: error
              ? colors.danger
              : focused
                ? colors.text
                : colors.cardBorder,
            paddingHorizontal: spacing.lg,
          },
        ]}
      >
        {icon && (
          <Ionicons name={icon} size={18} color={colors.textSecondary} style={{ marginRight: 8 }} />
        )}
        <TextInput
          testID={testID}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.accent}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          style={[typography.body, styles.input, { color: colors.text }, style]}
          {...rest}
        />
      </View>
      {error && (
        <Text style={[typography.small, { color: colors.danger, marginTop: 6 }]}>
          {error}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  label: { marginBottom: 8, textTransform: "uppercase" },
  field: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    minHeight: 52,
  },
  input: { flex: 1, paddingVertical: 12 },
});
