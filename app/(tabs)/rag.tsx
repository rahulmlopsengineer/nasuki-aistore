import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TAB_BAR_SPACE } from "@/src/components/navigation/BottomNavigation";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  LoadingIndicator,
} from "@/src/components/ui";
import { useToast } from "@/src/hooks/use-toast";
import { DocumentService } from "@/src/services";
import { DocumentFile, DocumentStatus } from "@/src/types";
import { useTheme } from "@/src/theme";
import { formatKb, relativeTime } from "@/src/utils/format";

const STATUS: Record<DocumentStatus, { tone: "info" | "warning" | "success" | "danger"; label: string }> = {
  uploading: { tone: "info", label: "Uploading" },
  processing: { tone: "warning", label: "Processing" },
  ready: { tone: "success", label: "Ready" },
  error: { tone: "danger", label: "Error" },
};

const TYPE_ICON: Record<DocumentFile["type"], keyof typeof Ionicons.glyphMap> = {
  pdf: "document-text",
  txt: "document",
  md: "logo-markdown",
  docx: "document-attach",
};

export default function RagDocuments() {
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [docs, setDocs] = useState<DocumentFile[]>([]);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    setDocs(await DocumentService.listDocuments());
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const upload = useCallback(async () => {
    setUploading(true);
    const name = `Document ${Math.floor(Math.random() * 90 + 10)}.pdf`;
    await DocumentService.upload(name, (doc) => {
      setDocs((prev) => {
        const exists = prev.some((d) => d.id === doc.id);
        return exists ? prev.map((d) => (d.id === doc.id ? doc : d)) : [doc, ...prev];
      });
    });
    setUploading(false);
    toast.show("Document ready", "success");
  }, [toast]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.xl }}>
        <Text style={[typography.h2, { color: colors.text, textAlign: "center" }]}>Documents</Text>
        <Text style={[typography.small, { color: colors.textSecondary, textAlign: "center", marginTop: 2 }]}>
          Chat with your PDFs & notes
        </Text>
      </View>

      {loading ? (
        <LoadingIndicator fullscreen label="Loading documents…" />
      ) : docs.length === 0 ? (
        <EmptyState
          icon="cloud-upload-outline"
          title="No documents yet"
          description="Upload a PDF or note to ground your AI answers in your own content."
          actionLabel="Upload document"
          onAction={upload}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.lg,
            paddingBottom: TAB_BAR_SPACE + 80,
            gap: spacing.md,
          }}
        >
          {docs.map((d, i) => {
            const st = STATUS[d.status];
            return (
              <Animated.View key={d.id} entering={FadeInDown.delay(i * 50).duration(280)}>
                <Card
                  testID={`document-${d.id}`}
                  onPress={d.status === "ready" ? () => router.push(`/rag/${d.id}`) : undefined}
                  style={styles.row}
                >
                  <View style={[styles.icon, { backgroundColor: colors.background, borderRadius: radius.md }]}>
                    <Ionicons name={TYPE_ICON[d.type]} size={22} color={colors.text} />
                  </View>
                  <View style={{ flex: 1, paddingHorizontal: spacing.md }}>
                    <Text style={[typography.title, { color: colors.text }]} numberOfLines={1}>
                      {d.name}
                    </Text>
                    <Text style={[typography.small, { color: colors.textSecondary }]}>
                      {formatKb(d.sizeKb)}
                      {d.status === "ready" ? ` · ${d.chunkCount} chunks` : ""} · {relativeTime(d.createdAt)}
                    </Text>
                  </View>
                  <Badge label={st.label} tone={st.tone} />
                </Card>
              </Animated.View>
            );
          })}
        </ScrollView>
      )}

      {docs.length > 0 && (
        <View style={[styles.footer, { paddingHorizontal: spacing.xl, bottom: TAB_BAR_SPACE - 8, paddingBottom: 0 }]}>
          <Button
            testID="rag-upload"
            label={uploading ? "Uploading…" : "Upload document"}
            icon="cloud-upload-outline"
            variant="solid"
            loading={uploading}
            onPress={upload}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  row: { flexDirection: "row", alignItems: "center", padding: 14 },
  icon: { width: 46, height: 46, alignItems: "center", justifyContent: "center" },
  footer: { position: "absolute", left: 0, right: 0 },
});
