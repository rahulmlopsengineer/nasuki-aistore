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
import {
  ChatService,
  LocalInference,
  DEFAULT_MODEL_ID,
  SUPPORTED_MODELS,
  getModelPath,
  ContextBuilder,
  ConversationSummarizer,
} from "@/src/services";
import { Conversation, Message } from "@/src/types";
import { useTheme } from "@/src/theme";

const SUGGESTIONS = [
  "Summarize this in 3 bullets",
  "Draft a friendly reply",
  "Explain like I'm five",
];

function cleanAssistantText(text: string): string {
  if (!text) return "";
  let cleaned = text;
  const stopIndex = cleaned.search(/(\nUser:|\nSystem:|\nUser|\nSystem|User:|System:)/i);
  if (stopIndex !== -1) {
    cleaned = cleaned.substring(0, stopIndex);
  }
  return cleaned.trim();
}

export default function ChatConversation() {
  const { colors, spacing, typography, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const searchParams = useLocalSearchParams<{ id: string }>();
  const id = Array.isArray(searchParams.id) ? searchParams.id[0] : (searchParams.id || "cnv-default");

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [title, setTitle] = useState("New chat");
  const [text, setText] = useState("");
  const [modelLoading, setModelLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const listRef = useRef<FlatList<Message>>(null);
  const generatingId = useRef<string | null>(null);
  const accumulatedContent = useRef<string>("");

  const subtitle = useMemo(
    () => (modelLoading ? "Model loading…" : "Gemma 2 2B · on-device"),
    [modelLoading],
  );

  useEffect(() => {
    (async () => {
      const convo = await ChatService.getConversation(id);
      if (convo) {
        setConversation(convo);
        setTitle(convo.title);
      }
      const existing = await ChatService.getMessages(id);
      setMessages(existing);
      setModelLoading(false); // Unblock UI immediately so conversation opens instantly

      // Initialize local inference model in background if not loaded
      try {
        if (!LocalInference.isModelLoaded()) {
          console.log("[NASUKI][CHAT] Loading local model in background...");
          const modelDef = SUPPORTED_MODELS[DEFAULT_MODEL_ID];
          LocalInference.loadModel({
            modelId: DEFAULT_MODEL_ID,
            filename: getModelPath(modelDef.filename),
          }).then((res) => {
            if (!res.success) {
              console.error("[NASUKI][CHAT] Background model load failed:", res.error);
            }
          });
        }
      } catch (e) {
        console.error("[NASUKI][CHAT] Model load error:", e);
      }
    })();
  }, [id]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, []);

  const send = useCallback(
    async (value: string) => {
      const content = value.trim();
      if (!content || generating) return;
      console.log("[NASUKI][CHAT][1] SEND_PRESSED");
      console.log("[NASUKI][CHAT][2] USER_PROMPT_RECEIVED:", content);
      setText("");
      setGenerating(true);

      let assistantMsgId: string | null = null;

      try {
        // Persist user message + generating assistant placeholder
        const userMsg = await ChatService.addUserMessage(id, content);
        console.log("[NASUKI][CHAT][3] USER_MESSAGE_SAVED:", userMsg.id);

        let assistantMsg = await ChatService.addAssistantMessage(id, "", "generating");
        if (!assistantMsg || !assistantMsg.id) {
          console.warn("[NASUKI][CHAT] Fallback assistant placeholder constructed");
          assistantMsg = {
            id: `m-asst-${Date.now()}`,
            conversationId: id,
            role: "assistant",
            content: "",
            status: "generating",
            state: "generating",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };
        }
        assistantMsgId = assistantMsg.id;
        generatingId.current = assistantMsg.id;
        accumulatedContent.current = "";

        setMessages((prev) => [...prev, userMsg, assistantMsg]);
        scrollToEnd();

        // Ensure model is loaded before generating
        console.log("[NASUKI][CHAT][4] ENSURE_MODEL_READY");
        if (!LocalInference.isModelLoaded()) {
          console.log("[NASUKI][CHAT] Model loading before generation...");
          const modelDef = SUPPORTED_MODELS[DEFAULT_MODEL_ID];
          const res = await LocalInference.loadModel({
            modelId: DEFAULT_MODEL_ID,
            filename: getModelPath(modelDef.filename),
          });
          if (!res.success) {
            throw new Error(res.error || "Model load failed");
          }
        }
        console.log("[NASUKI][CHAT][5] MODEL_READY");

        // Fetch fresh conversation to get latest summary if available
        const freshConvo = await ChatService.getConversation(id);
        const builtContext = ContextBuilder.buildConversationContext({
          conversationId: id,
          summary: freshConvo?.summary ?? conversation?.summary,
          messages,
          currentUserMessage: content,
          maxContextTokens: 200,
          reservedOutputTokens: 72,
        });

        console.log("[NASUKI][CHAT] Built Context Prompt:\n" + builtContext.prompt);
        console.log("[NASUKI][CHAT][6] GENERATE_CALLED");

        const result = await LocalInference.generate(builtContext.prompt, {
          maxTokens: builtContext.reservedOutputTokens,
          stopSequences: ["\nUser:", "User:", "\nSystem:", "System:", "\nUser", "\nSystem"],
          onToken: (token) => {
            if (!generatingId.current) return;
            accumulatedContent.current += token;
            const currentText = cleanAssistantText(accumulatedContent.current);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id ? { ...m, content: currentText } : m,
              ),
            );
            scrollToEnd();
          },
        });

        if (result.error) {
          throw new Error(result.error);
        }

        const finalContent = cleanAssistantText(result.text || accumulatedContent.current);
        await ChatService.completeAssistantMessage(id, assistantMsg.id, finalContent, "completed");
        console.log("[NASUKI][CHAT][12] ASSISTANT_MESSAGE_SAVED");

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: finalContent, state: "completed", status: "completed" }
              : m,
          ),
        );
        console.log("[NASUKI][CHAT][13] UI_UPDATED");
        console.log("[NASUKI][CHAT] Generation completed. Tokens:", result.metrics.tokenCount, "Speed:", result.metrics.tokensPerSec?.toFixed(2), "tok/s");

        // Post-generation background compaction check
        const updatedMsgCount = messages.length + 2;
        if (ConversationSummarizer.shouldSummarize(updatedMsgCount, builtContext.estimatedTokens)) {
          ConversationSummarizer.summarizeConversation(id).catch((err: any) =>
            console.warn("[NASUKI][CHAT] Background summarization error:", err)
          );
        }
      } catch (e: any) {
        console.error("[NASUKI][CHAT] Generation error:", e);
        const partial = accumulatedContent.current.trim() || "Inference error occurred.";
        if (assistantMsgId) {
          await ChatService.completeAssistantMessage(id, assistantMsgId, partial, "completed");
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId
                ? { ...m, content: partial, state: "completed", status: "completed" }
                : m,
            ),
          );
        }
      } finally {
        generatingId.current = null;
        setGenerating(false);
        console.log("[NASUKI][CHAT][14] SEND_COMPLETE");
        scrollToEnd();
      }
    },
    [conversation, generating, id, messages, scrollToEnd],
  );

  const stop = useCallback(async () => {
    console.log("[NASUKI][CHAT] Generation stop requested.");
    await LocalInference.stopGeneration();
    const genId = generatingId.current;
    setGenerating(false);

    if (genId) {
      const currentText = accumulatedContent.current.trim() || "Stopped.";
      await ChatService.completeAssistantMessage(id, genId, currentText, "completed");
      setMessages((prev) =>
        prev.map((m) =>
          m.id === genId ? { ...m, content: currentText, state: "stopped", status: "completed" } : m,
        ),
      );
      generatingId.current = null;
    }
    scrollToEnd();
  }, [id, scrollToEnd]);

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
