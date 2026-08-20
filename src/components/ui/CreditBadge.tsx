import React from "react";
import { StyleSheet, Text, View, ViewStyle } from "react-native";

import { useTheme } from "@/src/theme";
import { Logo } from "./Logo";

type Props = {
  balance: number;
  size?: "sm" | "lg";
  style?: ViewStyle;
  testID?: string;
};

// Credit balance pill: NASUKI mark + balance number (Figma Home badge).
export const CreditBadge: React.FC<Props> = ({ balance, size = "lg", style, testID }) => {
  const { colors, radius, fonts, typography } = useTheme();
  const large = size === "lg";

  return (
    <View
      testID={testID ?? "credit-badge"}
      accessibilityLabel={`${balance} credits`}
      style={[
        styles.wrap,
        {
          backgroundColor: colors.card,
          borderRadius: radius.pill,
          paddingVertical: large ? 8 : 5,
          paddingHorizontal: large ? 10 : 8,
          gap: large ? 12 : 6,
        },
        style,
      ]}
    >
      <View
        style={[
          styles.logo,
          { backgroundColor: colors.background, borderRadius: radius.pill },
        ]}
      >
        <Logo size={large ? 34 : 22} />
      </View>
      <Text
        style={[
          large ? typography.h1 : typography.title,
          { color: colors.text, fontFamily: fonts.bold, marginRight: large ? 12 : 6 },
        ]}
      >
        {balance}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start" },
  logo: { padding: 6, alignItems: "center", justifyContent: "center" },
});
