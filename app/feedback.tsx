import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Header, ScreenContainer, Touchable } from "@/src/components/ui";
import { FeedbackService } from "@/src/services";
import { FeedbackType } from "@/src/types";
import { useTheme } from "@/src/theme";

const TYPES: { key: FeedbackType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "general", label: "General", icon: "chatbox-outline" },
  { key: "feature", label: "Feature", icon: "bulb-outline" },
  { key: "praise", label: "Praise", icon: "heart-outline" },
  { key: "complaint", label: "Issue", icon: "sad-outline" },
];

export default function Feedback() {
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [type, setType] = useState<FeedbackType>("general");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!message.trim()) {
      setError("Please share a few words before submitting.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await FeedbackService.submit({ type, message });
      setReference(res.reference);
    } catch {
      setError("Couldn't submit right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (reference) {
    return (
      <ScreenContainer testID="feedback-success">
        <Header title="Feedback" showBack />
        <Animated.View entering={FadeIn} style={styles.success}>
          <View style={[styles.successIcon, { backgroundColor: colors.card, borderRadius: 60 }]}>
            <Ionicons name="checkmark-circle" size={56} color={colors.success} />
          </View>
          <Text style={[typography.h2, { color: colors.text, marginTop: spacing.lg }]}>Thank you!</Text>
          <Text style={[typography.body, { color: colors.textSecondary, textAlign: "center", marginTop: 6 }]}>
            Your feedback helps make NASUKI better.
          </Text>
          <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 8 }]}>
            Reference {reference}
          </Text>
          <Button label="Done" variant="solid" onPress={() => router.back()} fullWidth={false} style={{ marginTop: spacing.xl }} />
        </Animated.View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer testID="feedback-screen">
      <Header title="Send Feedback" showBack />
      <KeyboardAwareScrollView
        bottomOffset={24}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingBottom: insets.bottom + spacing.xl,
        }}
      >
        <Text style={[typography.label, { color: colors.textSecondary, marginBottom: spacing.md }]}>
          WHAT'S THIS ABOUT?
        </Text>
        <View style={styles.types}>
          {TYPES.map((t) => {
            const selected = type === t.key;
            return (
              <Touchable
                key={t.key}
                testID={`feedback-type-${t.key}`}
                onPress={() => setType(t.key)}
                haptic={false}
                scaleTo={0.97}
                style={[
                  styles.typeChip,
                  {
                    backgroundColor: selected ? colors.text : colors.card,
                    borderRadius: radius.md,
                  },
                ]}
                accessibilityState={{ selected }}
                accessibilityLabel={t.label}
              >
                <Ionicons name={t.icon} size={18} color={selected ? colors.textInverse : colors.textSecondary} />
                <Text style={[typography.bodyStrong, { color: selected ? colors.textInverse : colors.text }]}>
                  {t.label}
                </Text>
              </Touchable>
            );
          })}
        </View>

        <Text style={[typography.label, { color: colors.textSecondary, marginTop: spacing.xl, marginBottom: spacing.md }]}>
          YOUR MESSAGE
        </Text>
        <TextInput
          testID="feedback-message"
          value={message}
          onChangeText={(t) => {
            setMessage(t);
            setError(null);
          }}
          placeholder="Tell us what you think…"
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.accent}
          multiline
          style={[
            typography.body,
            styles.textarea,
            { backgroundColor: colors.card, borderRadius: radius.lg, color: colors.text, borderColor: error ? colors.danger : colors.cardBorder },
          ]}
        />
        {!!error && (
          <Text style={[typography.small, { color: colors.danger, marginTop: 8 }]}>{error}</Text>
        )}

        <Button
          testID="feedback-submit"
          label="Submit feedback"
          variant="solid"
          loading={submitting}
          onPress={submit}
          style={{ marginTop: spacing.xl }}
        />
      </KeyboardAwareScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  types: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  typeChip: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, height: 44 },
  textarea: { minHeight: 140, padding: 16, borderWidth: 1.5, textAlignVertical: "top" },
  success: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  successIcon: { width: 96, height: 96, alignItems: "center", justifyContent: "center" },
});
