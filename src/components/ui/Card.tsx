import React from "react";
import { StyleProp, View, ViewStyle } from "react-native";

import { useTheme } from "@/src/theme";
import { Touchable } from "./Touchable";

type Props = {
  children: React.ReactNode;
  onPress?: () => void;
  padded?: boolean;
  elevated?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  accessibilityLabel?: string;
};

export const Card: React.FC<Props> = ({
  children,
  onPress,
  padded = true,
  elevated = true,
  style,
  testID,
  accessibilityLabel,
}) => {
  const { colors, radius, spacing, shadows } = useTheme();

  const base: ViewStyle = {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: padded ? spacing.xl : 0,
  };

  if (onPress) {
    return (
      <Touchable
        testID={testID}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        scaleTo={0.98}
        style={[base, elevated ? shadows.sm : null, style]}
      >
        {children}
      </Touchable>
    );
  }

  return (
    <View testID={testID} style={[base, elevated ? shadows.sm : null, style]}>
      {children}
    </View>
  );
};
