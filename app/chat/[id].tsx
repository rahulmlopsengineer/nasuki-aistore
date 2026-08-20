import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  ChatBubble,
  EmptyState,
  Header,
  IconButton,
  ScreenContainer,
  Touchable,
} from "@/src/components/ui";
import { ChatService } from "@/src/services";
import { Message } from "@/src/types";
import { useTheme } from "@/src/theme";

const SUGGESTIONS = [
  "Summarize this in 3 bullets",
  "Draft a friendly reply",
  "Explain like I'm five",
];

export default function ChatConversation() {
  const { colors, spacing, typography, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [messages, setMessages] = useState<Message[]>([]);
  const [title, setTitle] = useState("New chat");
  const [text, setText] = useState("");
  const [modelLoading, setModelLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const generatingId = useRef<string | null>(null);

  const subtitle = useMemo(
    () => (modelLoading ? "Model loading…" : "Gamma · on-device"),
    [modelLoading],
  );

  useEffect(() => {
    (async () => {
      const convo = await ChatService.getConversation(id);
      if (convo) setTitle(convo.title);
      const existing = await ChatService.getMessages(id);
      setMessages(existing);
      setTimeout(() => setModelLoading(false), 700); // simulate model warmup
    })();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [id]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const send = useCallback(
    async (value: string) => {
      const content = value.trim();
      if (!content || generating) return;
      setText("");
      setGenerating(true);

      // Persist the user message + a generating assistant placeholder.
      const userMsg = await ChatService.addUserMessage(id, content);
      const assistantMsg = await ChatService.addAssistantMessage(id, "", "generating");
      generatingId.current = assistantMsg.id;
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      scrollToEnd();

      // MOCK reply (Phase 2 has no on-device LLM yet) — persisted on completion.
      timer.current = setTimeout(async () => {
        const reply = ChatService.generateMockReply(content);
        await ChatService.completeAssistantMessage(id, assistantMsg.id, reply, "completed");
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: reply, state: "completed", status: "completed" }
              : m,
          ),
        );
        generatingId.current = null;
        setGenerating(false);
        scrollToEnd();
      }, 1400);
    },
    [generating, id, scrollToEnd],
  );

  const stop = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    const genId = generatingId.current;
    setMessages((prev) =>
      prev.map((m) =>
        m.state === "generating"
          ? { ...m, content: m.content || "Stopped.", state: "stopped" }
          : m,
      ),
    );
    setGenerating(false);
    if (genId) {
      const current = messages.find((m) => m.id === genId);
      await ChatService.completeAssistantMessage(
        id,
        genId,
        current?.content || "Stopped.",
        "completed",
      );
      generatingId.current = null;
    }
  }, [id, messages]);

  return (
    <ScreenContainer testID="chat-conversation">
      <Header
        title={title}
        subtitle={subtitle}
        showBack
        right={
          <IconButton
            icon="ellipsis-horizontal"
            variant="ghost"
            size={40}
            onPress={() => {}}
            accessibilityLabel="Chat options"
          />
        }
      />

      <KeyboardAvoidingView
        behavior="translate-with-padding"
        keyboardVerticalOffset={insets.top + 8}
        style={styles.flex}
      >
        {messages.length === 0 ? (
          <View style={styles.emptyWrap}>
            <EmptyState
              icon="sparkles"
              title="Ask me anything"
              description="Your chat runs privately on your device. Try one of these to begin."
            />
            <View style={[styles.suggestions, { paddingHorizontal: spacing.xl }]}>
              {SUGGESTIONS.map((s) => (
                <Touchable
                  key={s}
                  testID={`suggestion-${s}`}
                  onPress={() => send(s)}
                  scaleTo={0.97}
                  haptic={false}
                  style={[styles.chip, { backgroundColor: colors.card, borderRadius: radius.md }]}
                  accessibilityLabel={s}
                >
                  <Ionicons name="arrow-forward" size={15} color={colors.accent} />
                  <Text style={[typography.bodyStrong, { color: colors.text }]}>{s}</Text>
                </Touchable>
              ))}
            </View>
          </View>
        ) : (
          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => (
              <ChatBubble
                testID={`message-${item.id}`}
                role={item.role}
                content={item.content}
                state={item.state}
              />
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: spacing.xl }}
            onContentSizeChange={scrollToEnd}
          />
        )}

        {/* Input bar */}
        <View
          style={[
            styles.inputBar,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.cardBorder,
              paddingBottom: insets.bottom + spacing.sm,
              paddingHorizontal: spacing.lg,
            },
          ]}
        >
          <View style={[styles.inputWrap, { backgroundColor: colors.card, borderRadius: radius.xl }]}>
            <TextInput
              testID="chat-input"
              value={text}
              onChangeText={setText}
              placeholder="Message NASUKI…"
              placeholderTextColor={colors.textTertiary}
              selectionColor={colors.accent}
              multiline
              style={[typography.body, styles.textInput, { color: colors.text }]}
            />
          </View>
          {generating ? (
            <IconButton
              testID="chat-stop"
              icon="stop"
              variant="solid"
              size={48}
              onPress={stop}
              accessibilityLabel="Stop generating"
            />
          ) : (
            <IconButton
              testID="chat-send"
              icon="arrow-up"
              variant="solid"
              size={48}
              onPress={() => send(text)}
              disabled={!text.trim()}
              accessibilityLabel="Send message"
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  emptyWrap: { flex: 1, justifyContent: "center" },
  suggestions: { gap: 10 },
  chip: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14 },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    borderTopWidth: 1,
    paddingTop: 10,
  },
  inputWrap: { flex: 1, minHeight: 48, justifyContent: "center", paddingHorizontal: 16 },
  textInput: { paddingVertical: 12, maxHeight: 120 },
});
