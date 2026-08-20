import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/src/theme";
import { Touchable } from "./Touchable";

type Props = {
  title?: string;
  subtitle?: string;
  showBack?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
  centerTitle?: boolean;
  testID?: string;
};

export const Header: React.FC<Props> = ({
  title,
  subtitle,
  showBack = false,
  onBack,
  right,
  centerTitle = true,
  testID,
}) => {
  const { colors, typography, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View
      testID={testID}
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: spacing.xl,
          backgroundColor: colors.background,
        },
      ]}
    >
      <View style={styles.side}>
        {showBack && (
          <Touchable
            testID="header-back"
            onPress={() => (onBack ? onBack() : router.back())}
            scaleTo={0.9}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            style={[styles.backBtn, { backgroundColor: colors.card }]}
          >
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Touchable>
        )}
      </View>

      <View style={[styles.center, { alignItems: centerTitle ? "center" : "flex-start" }]}>
        {!!title && (
          <Text numberOfLines={1} style={[typography.h3, { color: colors.text }]}>
            {title}
          </Text>
        )}
        {!!subtitle && (
          <Text numberOfLines={1} style={[typography.small, { color: colors.textSecondary }]}>
            {subtitle}
          </Text>
        )}
      </View>

      <View style={[styles.side, { alignItems: "flex-end" }]}>{right}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 12,
  },
  side: { width: 44, justifyContent: "center" },
  center: { flex: 1, justifyContent: "center" },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
