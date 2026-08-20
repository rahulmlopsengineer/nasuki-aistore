import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";

import { useTheme } from "@/src/theme";
import { Button } from "./Button";

type Props = {
  title?: string;
  description?: string;
  onRetry?: () => void;
  offline?: boolean;
  style?: ViewStyle;
  testID?: string;
};

export const ErrorState: React.FC<Props> = ({
  title,
  description,
  onRetry,
  offline = false,
  style,
  testID,
}) => {
  const { colors, typography, spacing, radius } = useTheme();
  const icon = offline ? "cloud-offline-outline" : "warning-outline";
  const heading = title ?? (offline ? "You're offline" : "Something went wrong");
  const body =
    description ??
    (offline
      ? "Check your connection and try again."
      : "We couldn't complete that action. Please try again.");

  return (
    <View testID={testID ?? "error-state"} style={[styles.wrap, style]}>
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: colors.card, borderRadius: radius.xxl },
        ]}
      >
        <Ionicons name={icon} size={34} color={colors.danger} />
      </View>
      <Text style={[typography.h3, { color: colors.text, marginTop: spacing.xl }]}>
        {heading}
      </Text>
      <Text
        style={[
          typography.body,
          { color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm },
        ]}
      >
        {body}
      </Text>
      {onRetry && (
        <View style={{ marginTop: spacing.xl }}>
          <Button
            label="Try again"
            icon="refresh"
            variant="solid"
            onPress={onRetry}
            fullWidth={false}
            testID="error-retry"
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", padding: 32 },
  iconWrap: { width: 76, height: 76, alignItems: "center", justifyContent: "center" },
});
