import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

const Dot: React.FC<{ color: string; delay: number }> = ({ color, delay }) => {
  const o = useSharedValue(0.3);
  useEffect(() => {
    o.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 350 }),
          withTiming(0.3, { duration: 350 }),
        ),
        -1,
      ),
    );
  }, [o, delay]);
  const style = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[styles.dot, { backgroundColor: color }, style]} />;
};

export const TypingDots: React.FC<{ color: string }> = ({ color }) => (
  <View style={styles.row}>
    <Dot color={color} delay={0} />
    <Dot color={color} delay={150} />
    <Dot color={color} delay={300} />
  </View>
);

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
