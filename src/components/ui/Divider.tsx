import React from "react";
import { View, ViewStyle } from "react-native";

import { useTheme } from "@/src/theme";

export const Divider: React.FC<{ style?: ViewStyle; inset?: number }> = ({
  style,
  inset = 0,
}) => {
  const { colors } = useTheme();
  return (
    <View
      style={[
        { height: 1, backgroundColor: colors.cardBorder, marginHorizontal: inset },
        style,
      ]}
    />
  );
};
