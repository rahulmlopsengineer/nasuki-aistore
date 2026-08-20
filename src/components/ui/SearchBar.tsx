import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, StyleSheet, TextInput, View, ViewStyle } from "react-native";

import { useTheme } from "@/src/theme";

type Props = {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  onClear?: () => void;
  style?: ViewStyle;
  testID?: string;
};

export const SearchBar: React.FC<Props> = ({
  value,
  onChangeText,
  placeholder = "Search",
  onClear,
  style,
  testID,
}) => {
  const { colors, radius, spacing, typography } = useTheme();
  return (
    <View
      style={[
        styles.wrap,
        {
          backgroundColor: colors.card,
          borderRadius: radius.pill,
          paddingHorizontal: spacing.lg,
        },
        style,
      ]}
    >
      <Ionicons name="search" size={18} color={colors.textSecondary} />
      <TextInput
        testID={testID}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        selectionColor={colors.accent}
        returnKeyType="search"
        style={[typography.body, styles.input, { color: colors.text }]}
      />
      {value.length > 0 && (
        <Pressable
          testID="search-clear"
          onPress={() => {
            onChangeText("");
            onClear?.();
          }}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Clear search"
        >
          <Ionicons name="close-circle" size={18} color={colors.textTertiary} />
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 48,
  },
  input: { flex: 1, paddingVertical: 0 },
});
