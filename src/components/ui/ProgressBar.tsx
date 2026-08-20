import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect, useState } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { progressGradient, useTheme } from "@/src/theme";

type Props = {
  progress: number; // 0..1
  height?: number;
  gradient?: boolean; // rainbow gradient (Figma download bar)
  trackColor?: string;
  fillColor?: string;
  style?: ViewStyle;
  testID?: string;
};

export const ProgressBar: React.FC<Props> = ({
  progress,
  height = 8,
  gradient = false,
  trackColor,
  fillColor,
  style,
  testID,
}) => {
  const { colors, radius } = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);
  const w = useSharedValue(0);
  const clamped = Math.max(0, Math.min(1, progress));

  useEffect(() => {
    w.value = withTiming(clamped * trackWidth, { duration: 350 });
  }, [clamped, trackWidth, w]);

  const fillStyle = useAnimatedStyle(() => ({ width: w.value }));

  return (
    <View
      testID={testID}
      onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
      style={[
        {
          height,
          borderRadius: radius.pill,
          backgroundColor: trackColor ?? colors.skeleton,
          overflow: "hidden",
        },
        style,
      ]}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <Animated.View style={[styles.fill, fillStyle]}>
        {gradient ? (
          <LinearGradient
            colors={progressGradient as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ width: trackWidth, height }}
          />
        ) : (
          <View
            style={{
              width: trackWidth,
              height,
              backgroundColor: fillColor ?? colors.text,
            }}
          />
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  fill: { height: "100%", overflow: "hidden" },
});
