import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TAB_BAR_SPACE } from "@/src/components/navigation/BottomNavigation";
import {
  BottomSheet,
  Button,
  Card,
  EmptyState,
  IconButton,
  Input,
  LoadingIndicator,
  Modal,
  SearchBar,
  Touchable,
} from "@/src/components/ui";
import { useToast } from "@/src/hooks/use-toast";
import { ChatService, ModelService } from "@/src/services";
import { Conversation } from "@/src/types";
import { useTheme } from "@/src/theme";
import { relativeTime } from "@/src/utils/format";

export default function ChatHistory() {
  const { colors, radius, spacing, typography, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Conversation[]>([]);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState<Conversation | null>(null);
  const [renaming, setRenaming] = useState(false);
  const [renameText, setRenameText] = useState("");

  const load = useCallback(async () => {
    setItems(await ChatService.listConversations());
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filtered = useMemo(
    () =>
      items.filter(
        (c) =>
          c.title.toLowerCase().includes(query.toLowerCase()) ||
          c.lastMessage.toLowerCase().includes(query.toLowerCase()),
      ),
    [items, query],
  );

  const newChat = async () => {
    const models = await ModelService.listModels();
    const convo = await ChatService.createConversation(models[0]?.id ?? "mdl-gamma");
    router.push(`/chat/${convo.id}`);
  };

  const doPin = async () => {
    if (!active) return;
    await ChatService.togglePin(active.id);
    setActive(null);
    load();
  };
  const doDelete = async () => {
    if (!active) return;
    await ChatService.deleteConversation(active.id);
    setActive(null);
    toast.show("Conversation deleted", "success");
    load();
  };
  const doRename = async () => {
    if (!active || !renameText.trim()) return;
    await ChatService.renameConversation(active.id, renameText.trim());
    setRenaming(false);
    setActive(null);
    load();
  };

  const renderItem = ({ item }: { item: Conversation }) => (
    <Card
      testID={`conversation-${item.id}`}
      onPress={() => router.push(`/chat/${item.id}`)}
      style={styles.row}
    >
      <View style={[styles.avatar, { backgroundColor: colors.background, borderRadius: radius.md }]}>
        <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.text} />
      </View>
      <View style={{ flex: 1, paddingHorizontal: spacing.md }}>
        <View style={styles.titleRow}>
          {item.pinned && <Ionicons name="pin" size={13} color={colors.accent} />}
          <Text style={[typography.title, { color: colors.text }]} numberOfLines={1}>
            {item.title}
          </Text>
        </View>
        <Text style={[typography.small, { color: colors.textSecondary }]} numberOfLines={1}>
          {item.lastMessage || "No messages yet"}
        </Text>
      </View>
      <View style={styles.meta}>
        <Text style={[typography.caption, { color: colors.textTertiary }]}>
          {relativeTime(item.updatedAt)}
        </Text>
        <Touchable
          testID={`conversation-menu-${item.id}`}
          onPress={() => {
            setActive(item);
            setRenameText(item.title);
          }}
          haptic={false}
          scaleTo={0.9}
          hitSlop={8}
          accessibilityLabel="Conversation options"
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.textSecondary} />
        </Touchable>
      </View>
    </Card>
  );

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Sticky header */}
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.xl }}>
        <Text style={[typography.h2, { color: colors.text, textAlign: "center" }]}>Chats</Text>
        <SearchBar
          testID="chat-search"
          value={query}
          onChangeText={setQuery}
          placeholder="Search conversations"
          style={{ marginTop: spacing.md }}
        />
      </View>

      {loading ? (
        <LoadingIndicator fullscreen label="Loading conversations…" />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon="chatbubbles-outline"
          title={query ? "No matches" : "No conversations yet"}
          description={query ? "Try a different search." : "Start a new chat with your local AI."}
          actionLabel={query ? undefined : "New chat"}
          onAction={query ? undefined : newChat}
        />
      ) : (
        <Animated.View entering={FadeIn} style={{ flex: 1 }}>
          <FlatList
            data={filtered}
            keyExtractor={(c) => c.id}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingHorizontal: spacing.xl,
              paddingTop: spacing.lg,
              paddingBottom: TAB_BAR_SPACE + spacing.xl,
              gap: spacing.md,
            }}
          />
        </Animated.View>
      )}

      {/* New chat FAB */}
      <IconButton
        testID="chat-fab"
        icon="add"
        variant="solid"
        onPress={newChat}
        size={58}
        accessibilityLabel="New chat"
        style={[styles.fab, shadows.lg, { bottom: TAB_BAR_SPACE + 8 }]}
      />

      {/* Options sheet */}
      <BottomSheet visible={!!active && !renaming} onClose={() => setActive(null)} title={active?.title}>
        <View style={{ gap: spacing.sm }}>
          <SheetAction
            icon={active?.pinned ? "pin-outline" : "pin"}
            label={active?.pinned ? "Unpin" : "Pin to top"}
            onPress={doPin}
            testID="sheet-pin"
          />
          <SheetAction
            icon="pencil"
            label="Rename"
            onPress={() => setRenaming(true)}
            testID="sheet-rename"
          />
          <SheetAction icon="trash" label="Delete" danger onPress={doDelete} testID="sheet-delete" />
        </View>
      </BottomSheet>

      {/* Rename modal */}
      <Modal visible={renaming} onClose={() => setRenaming(false)} title="Rename chat">
        <Input
          testID="rename-input"
          value={renameText}
          onChangeText={setRenameText}
          placeholder="Conversation name"
          autoFocus
        />
        <Button
          testID="rename-save"
          label="Save"
          onPress={doRename}
          variant="solid"
          style={{ marginTop: spacing.lg }}
        />
      </Modal>
    </View>
  );
}

const SheetAction: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
  testID?: string;
}> = ({ icon, label, onPress, danger, testID }) => {
  const { colors, radius, spacing, typography } = useTheme();
  return (
    <Touchable
      testID={testID}
      onPress={onPress}
      haptic={false}
      scaleTo={0.98}
      style={[styles.sheetAction, { backgroundColor: colors.card, borderRadius: radius.md, padding: spacing.lg }]}
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={20} color={danger ? colors.danger : colors.text} />
      <Text style={[typography.bodyStrong, { color: danger ? colors.danger : colors.text }]}>
        {label}
      </Text>
    </Touchable>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", padding: 14 },
  avatar: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  meta: { alignItems: "flex-end", gap: 8 },
  fab: { position: "absolute", right: 24 },
  sheetAction: { flexDirection: "row", alignItems: "center", gap: 12 },
});
