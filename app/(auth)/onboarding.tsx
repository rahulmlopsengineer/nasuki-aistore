import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeInRight } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, ScreenContainer, Touchable } from "@/src/components/ui";
import { onboardingSlides } from "@/src/constants/mock-data";
import { useAuth } from "@/src/hooks/use-auth";
import { useTheme } from "@/src/theme";

export default function Onboarding() {
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { completeOnboarding } = useAuth();
  const [index, setIndex] = useState(0);

  const slide = onboardingSlides[index];
  const isLast = index === onboardingSlides.length - 1;

  const finish = async () => {
    await completeOnboarding();
    router.replace("/(auth)/login");
  };

  const next = () => (isLast ? finish() : setIndex((i) => i + 1));
  const back = () => setIndex((i) => Math.max(0, i - 1));

  return (
    <ScreenContainer testID="onboarding-screen">
      <View style={{ height: insets.top + 8 }} />

      <View style={[styles.topBar, { paddingHorizontal: spacing.xl }]}>
        <Touchable
          testID="onboarding-back"
          onPress={back}
          disabled={index === 0}
          haptic={false}
          scaleTo={0.9}
          style={{ opacity: index === 0 ? 0 : 1 }}
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={26} color={colors.text} />
        </Touchable>
        <Touchable testID="onboarding-skip" onPress={finish} haptic={false} accessibilityLabel="Skip">
          <Text style={[typography.bodyStrong, { color: colors.textSecondary }]}>Skip</Text>
        </Touchable>
      </View>

      <View style={[styles.body, { paddingHorizontal: spacing.xl }]}>
        <Animated.View
          key={slide.id}
          entering={FadeInRight.duration(320)}
          style={styles.slide}
        >
          <View
            style={[
              styles.art,
              { backgroundColor: colors.card, borderRadius: radius.xxl },
            ]}
          >
            <MaterialCommunityIcons name={slide.icon as never} size={92} color={colors.text} />
          </View>
          <Text style={[typography.display, { color: colors.text, marginTop: spacing.x3l }]}>
            {slide.title}
          </Text>
          <Text
            style={[
              typography.body,
              { color: colors.textSecondary, textAlign: "center", marginTop: spacing.md },
            ]}
          >
            {slide.body}
          </Text>
        </Animated.View>
      </View>

      <View style={[styles.footer, { paddingHorizontal: spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.dots}>
          {onboardingSlides.map((s, i) => (
            <Animated.View
              key={s.id}
              entering={FadeIn}
              style={[
                styles.dot,
                {
                  backgroundColor: i === index ? colors.text : colors.cardBorder,
                  width: i === index ? 22 : 8,
                },
              ]}
            />
          ))}
        </View>
        <Button
          testID="onboarding-next"
          label={isLast ? "Get Started" : "Next"}
          onPress={next}
          variant={isLast ? "solid" : "accent"}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  topBar: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  body: { flex: 1, justifyContent: "center" },
  slide: { alignItems: "center" },
  art: { width: 180, height: 180, alignItems: "center", justifyContent: "center" },
  footer: { gap: 20 },
  dots: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  dot: { height: 8, borderRadius: 4 },
});
