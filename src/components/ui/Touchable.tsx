// Touchable — Pressable with a subtle scale animation + optional haptics.
// Base for Button, IconButton, Card and other tappable surfaces.

import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, PressableProps, StyleProp, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = PressableProps & {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: boolean;
  disabled?: boolean;
};

export const Touchable: React.FC<Props> = ({
  children,
  style,
  scaleTo = 0.96,
  haptic = true,
  disabled,
  onPress,
  ...rest
}) => {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        scale.value = withTiming(scaleTo, { duration: 90 });
        rest.onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withTiming(1, { duration: 120 });
        rest.onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic && Platform.OS !== "web") {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        }
        onPress?.(e);
      }}
      style={[{ opacity: disabled ? 0.5 : 1 }, animStyle, style]}
    >
      {children}
    </AnimatedPressable>
  );
};
