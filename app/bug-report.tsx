import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Button, Header, ScreenContainer, Touchable } from "@/src/components/ui";
import { useToast } from "@/src/hooks/use-toast";
import { BugReportService } from "@/src/services";
import { BugCategory } from "@/src/types";
import { useTheme } from "@/src/theme";

const CATEGORIES: { key: BugCategory; label: string }[] = [
  { key: "crash", label: "Crash" },
  { key: "ui", label: "UI glitch" },
  { key: "performance", label: "Performance" },
  { key: "data", label: "Data loss" },
  { key: "other", label: "Other" },
];

export default function BugReport() {
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();

  const [category, setCategory] = useState<BugCategory>("crash");
  const [description, setDescription] = useState("");
  const [hasShot, setHasShot] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!description.trim()) {
      setError("Please describe what went wrong.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await BugReportService.submit({ category, description });
      setReference(res.reference);
    } catch {
      setError("Couldn't submit right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (reference) {
    return (
      <ScreenContainer testID="bug-success">
        <Header title="Report a Bug" showBack />
        <Animated.View entering={FadeIn} style={styles.success}>
          <View style={[styles.successIcon, { backgroundColor: colors.card, borderRadius: 60 }]}>
            <Ionicons name="checkmark-circle" size={56} color={colors.success} />
          </View>
          <Text style={[typography.h2, { color: colors.text, marginTop: spacing.lg }]}>Report sent</Text>
          <Text style={[typography.body, { color: colors.textSecondary, textAlign: "center", marginTop: 6 }]}>
            Thanks for helping us squash bugs.
          </Text>
          <Text style={[typography.caption, { color: colors.textTertiary, marginTop: 8 }]}>
            Ticket {reference}
          </Text>
          <Button label="Done" variant="solid" onPress={() => router.back()} fullWidth={false} style={{ marginTop: spacing.xl }} />
        </Animated.View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer testID="bug-report-screen">
      <Header title="Report a Bug" showBack />
      <KeyboardAwareScrollView
        bottomOffset={24}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingBottom: insets.bottom + spacing.xl,
        }}
      >
        <Text style={[typography.label, { color: colors.textSecondary, marginBottom: spacing.md }]}>
          CATEGORY
        </Text>
        <View style={styles.cats}>
          {CATEGORIES.map((c) => {
            const selected = category === c.key;
            return (
              <Touchable
                key={c.key}
                testID={`bug-category-${c.key}`}
                onPress={() => setCategory(c.key)}
                haptic={false}
                scaleTo={0.97}
                style={[
                  styles.chip,
                  { backgroundColor: selected ? colors.text : colors.card, borderRadius: radius.pill },
                ]}
                accessibilityState={{ selected }}
                accessibilityLabel={c.label}
              >
                <Text style={[typography.label, { color: selected ? colors.textInverse : colors.textSecondary }]}>
                  {c.label}
                </Text>
              </Touchable>
            );
          })}
        </View>

        <Text style={[typography.label, { color: colors.textSecondary, marginTop: spacing.xl, marginBottom: spacing.md }]}>
          DESCRIPTION
        </Text>
        <TextInput
          testID="bug-description"
          value={description}
          onChangeText={(t) => {
            setDescription(t);
            setError(null);
          }}
          placeholder="Steps to reproduce, what you expected, what happened…"
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.accent}
          multiline
          style={[
            typography.body,
            styles.textarea,
            { backgroundColor: colors.card, borderRadius: radius.lg, color: colors.text, borderColor: error ? colors.danger : colors.cardBorder },
          ]}
        />
        {!!error && <Text style={[typography.small, { color: colors.danger, marginTop: 8 }]}>{error}</Text>}

        <Text style={[typography.label, { color: colors.textSecondary, marginTop: spacing.xl, marginBottom: spacing.md }]}>
          SCREENSHOT (OPTIONAL)
        </Text>
        <Touchable
          testID="bug-screenshot"
          onPress={() => {
            setHasShot((v) => !v);
            toast.show(hasShot ? "Screenshot removed" : "Screenshot attached (mock)", "info");
          }}
          haptic={false}
          scaleTo={0.98}
          style={[
            styles.shot,
            { borderColor: colors.cardBorder, borderRadius: radius.lg, backgroundColor: colors.card },
          ]}
          accessibilityLabel="Attach screenshot"
        >
          <Ionicons
            name={hasShot ? "image" : "image-outline"}
            size={26}
            color={hasShot ? colors.accent : colors.textSecondary}
          />
          <Text style={[typography.small, { color: colors.textSecondary, marginTop: 6 }]}>
            {hasShot ? "screenshot.png attached · tap to remove" : "Tap to add a screenshot"}
          </Text>
        </Touchable>

        <Button
          testID="bug-submit"
          label="Submit report"
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
  cats: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { height: 36, paddingHorizontal: 16, alignItems: "center", justifyContent: "center" },
  textarea: { minHeight: 140, padding: 16, borderWidth: 1.5, textAlignVertical: "top" },
  shot: {
    height: 120,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  success: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  successIcon: { width: 96, height: 96, alignItems: "center", justifyContent: "center" },
});
