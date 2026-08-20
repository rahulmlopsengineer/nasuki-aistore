import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";

import { useTheme } from "@/src/theme";

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
  testID?: string;
};

// Full-bleed screen background. Header/scroll handle their own safe-area insets.
export const ScreenContainer: React.FC<Props> = ({ children, style, testID }) => {
  const { colors } = useTheme();
  return (
    <View testID={testID} style={[styles.flex, { backgroundColor: colors.background }, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({ flex: { flex: 1 } });
