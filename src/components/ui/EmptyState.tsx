import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";

import { useTheme } from "@/src/theme";
import { Button } from "./Button";

type Props = {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
  testID?: string;
};

export const EmptyState: React.FC<Props> = ({
  icon = "sparkles-outline",
  title,
  description,
  actionLabel,
  onAction,
  style,
  testID,
}) => {
  const { colors, typography, spacing, radius } = useTheme();
  return (
    <View testID={testID ?? "empty-state"} style={[styles.wrap, style]}>
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: colors.card, borderRadius: radius.xxl },
        ]}
      >
        <Ionicons name={icon} size={34} color={colors.textSecondary} />
      </View>
      <Text style={[typography.h3, { color: colors.text, marginTop: spacing.xl }]}>
        {title}
      </Text>
      {!!description && (
        <Text
          style={[
            typography.body,
            { color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm },
          ]}
        >
          {description}
        </Text>
      )}
      {actionLabel && onAction && (
        <View style={{ marginTop: spacing.xl }}>
          <Button label={actionLabel} onPress={onAction} fullWidth={false} testID="empty-action" />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", padding: 32 },
  iconWrap: { width: 76, height: 76, alignItems: "center", justifyContent: "center" },
});
