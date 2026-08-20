import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Badge,
  Button,
  Card,
  Header,
  LoadingIndicator,
  ScreenContainer,
} from "@/src/components/ui";
import { DocumentService } from "@/src/services";
import { DocumentFile } from "@/src/types";
import { useTheme } from "@/src/theme";
import { formatKb, relativeTime } from "@/src/utils/format";

const CHUNKS = [
  "Introduction — overview of goals, scope and target users for the project.",
  "Requirements — functional and non-functional requirements captured from stakeholders.",
  "Architecture — high-level components, data flow and the chosen technology stack.",
  "Milestones — phased delivery plan with acceptance criteria for each release.",
];

export default function DocumentDetails() {
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [doc, setDoc] = useState<DocumentFile | null>(null);

  useEffect(() => {
    DocumentService.getDocument(id).then((d) => setDoc(d ?? null));
  }, [id]);

  if (!doc) {
    return (
      <ScreenContainer>
        <Header showBack />
        <LoadingIndicator fullscreen />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer testID="document-details">
      <Header title="Document" showBack />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingBottom: insets.bottom + 120,
          gap: spacing.lg,
        }}
      >
        <View style={styles.hero}>
          <View style={[styles.icon, { backgroundColor: colors.card, borderRadius: radius.xl }]}>
            <Ionicons name="document-text" size={40} color={colors.text} />
          </View>
          <Text style={[typography.h2, { color: colors.text, marginTop: spacing.md, textAlign: "center" }]}>
            {doc.name}
          </Text>
          <View style={styles.badges}>
            <Badge label={doc.type.toUpperCase()} />
            <Badge label={formatKb(doc.sizeKb)} />
            <Badge
              label={doc.status === "ready" ? `${doc.chunkCount} chunks` : "Processing"}
              tone={doc.status === "ready" ? "success" : "warning"}
            />
          </View>
          <Text style={[typography.small, { color: colors.textSecondary, marginTop: 6 }]}>
            Added {relativeTime(doc.createdAt)}
          </Text>
        </View>

        <Card>
          <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.sm }]}>Indexed content</Text>
          <Text style={[typography.small, { color: colors.textSecondary, marginBottom: spacing.md }]}>
            Preview of the chunks used to answer your questions. Vector search arrives in a later phase.
          </Text>
          <View style={{ gap: spacing.sm }}>
            {CHUNKS.slice(0, doc.status === "ready" ? CHUNKS.length : 0).map((c, i) => (
              <View
                key={i}
                style={[styles.chunk, { backgroundColor: colors.background, borderRadius: radius.md }]}
              >
                <Text style={[typography.label, { color: colors.textTertiary }]}>#{i + 1}</Text>
                <Text style={[typography.small, { color: colors.text, marginTop: 2 }]}>{c}</Text>
              </View>
            ))}
          </View>
        </Card>
      </ScrollView>

      <View
        style={[
          styles.footer,
          { backgroundColor: colors.background, borderTopColor: colors.cardBorder, paddingBottom: insets.bottom + spacing.md, paddingHorizontal: spacing.xl },
        ]}
      >
        <Button
          testID="ask-document"
          label="Ask about this document"
          icon="chatbubble-ellipses-outline"
          variant="solid"
          disabled={doc.status !== "ready"}
          onPress={() => {}}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", paddingTop: 8 },
  icon: { width: 84, height: 84, alignItems: "center", justifyContent: "center" },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12, justifyContent: "center" },
  chunk: { padding: 12 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopWidth: 1, paddingTop: 14 },
});
