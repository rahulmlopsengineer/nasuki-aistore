import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import { useTheme } from "@/src/theme";
import { ChatMessageState, MessageRole } from "@/src/types";
import { TypingDots } from "./TypingDots";

type Props = {
  role: MessageRole;
  content: string;
  state?: ChatMessageState;
  testID?: string;
};

export const ChatBubble: React.FC<Props> = ({
  role,
  content,
  state = "completed",
  testID,
}) => {
  const { colors, radius, spacing, typography } = useTheme();
  const isUser = role === "user";
  const isBusy = state === "typing" || state === "generating";

  return (
    <Animated.View
      entering={FadeInDown.duration(220)}
      testID={testID}
      style={[styles.row, { justifyContent: isUser ? "flex-end" : "flex-start" }]}
    >
      <View
        style={[
          styles.bubble,
          {
            backgroundColor: isUser ? colors.text : colors.card,
            borderTopRightRadius: isUser ? radius.xs : radius.lg,
            borderTopLeftRadius: isUser ? radius.lg : radius.xs,
            borderBottomLeftRadius: radius.lg,
            borderBottomRightRadius: radius.lg,
            paddingVertical: spacing.md,
            paddingHorizontal: spacing.lg,
          },
        ]}
      >
        {isBusy && !content ? (
          <TypingDots color={colors.textSecondary} />
        ) : (
          <Text
            style={[
              typography.body,
              { color: isUser ? colors.textInverse : colors.text },
            ]}
          >
            {content}
          </Text>
        )}
        {state === "error" && (
          <View style={styles.errRow}>
            <Ionicons name="alert-circle" size={14} color={colors.danger} />
            <Text style={[typography.caption, { color: colors.danger }]}>
              Failed to generate
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  row: { width: "100%", marginBottom: 12 },
  bubble: { maxWidth: "84%" },
  errRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
});
