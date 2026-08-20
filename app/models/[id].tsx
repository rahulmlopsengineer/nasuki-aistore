import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Badge,
  Button,
  Card,
  DownloadProgress,
  Header,
  LoadingIndicator,
  Logo,
  ScreenContainer,
} from "@/src/components/ui";
import { useToast } from "@/src/hooks/use-toast";
import { ModelService } from "@/src/services";
import { AIModel, InstalledModel } from "@/src/types";
import { useTheme } from "@/src/theme";
import { formatPrice, formatSize } from "@/src/utils/format";

const Spec: React.FC<{ icon: keyof typeof Ionicons.glyphMap; label: string; value: string }> = ({
  icon,
  label,
  value,
}) => {
  const { colors, radius, spacing, typography } = useTheme();
  return (
    <View style={[styles.spec, { backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.lg }]}>
      <Ionicons name={icon} size={20} color={colors.textSecondary} />
      <Text style={[typography.label, { color: colors.textSecondary, marginTop: 8 }]}>{label}</Text>
      <Text style={[typography.title, { color: colors.text, marginTop: 2 }]}>{value}</Text>
    </View>
  );
};

export default function ModelDetails() {
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();

  const [model, setModel] = useState<AIModel | null>(null);
  const [install, setInstall] = useState<InstalledModel | null>(null);

  useEffect(() => {
    (async () => {
      const m = await ModelService.getModel(id);
      const s = await ModelService.getInstallState(id);
      setModel(m ?? null);
      setInstall(s);
    })();
  }, [id]);

  const download = useCallback(async () => {
    if (!model) return;
    setInstall({ modelId: model.id, status: "downloading", progress: 0 });
    await ModelService.download(model.id, (progress) =>
      setInstall({ modelId: model.id, status: "downloading", progress }),
    );
    setInstall({ modelId: model.id, status: "installed", progress: 1 });
    toast.show(`${model.name} installed`, "success");
  }, [model, toast]);

  const remove = useCallback(async () => {
    if (!model) return;
    await ModelService.remove(model.id);
    setInstall({ modelId: model.id, status: "not_installed", progress: 0 });
    toast.show(`${model.name} removed`, "info");
  }, [model, toast]);

  if (!model || !install) {
    return (
      <ScreenContainer>
        <Header showBack />
        <LoadingIndicator fullscreen />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer testID="model-details">
      <Header title="Model" showBack />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingBottom: insets.bottom + 120,
          gap: spacing.lg,
        }}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={[styles.heroLogo, { backgroundColor: colors.card, borderRadius: radius.xl }]}>
            <Logo size={54} variant="badge" />
          </View>
          <Text style={[typography.h1, { color: colors.text, marginTop: spacing.lg }]}>{model.name}</Text>
          <Text style={[typography.body, { color: colors.textSecondary }]}>{model.tagline}</Text>
          <View style={styles.badges}>
            <Badge label={`v${model.version}`} />
            <Badge label={model.license} tone="info" />
            <Badge label={formatPrice(model.price)} tone={model.price === 0 ? "success" : "accent"} />
          </View>
        </View>

        {/* Specs grid */}
        <View style={styles.grid}>
          <Spec icon="hardware-chip-outline" label="Min RAM" value={`${model.minRamGb} GB`} />
          <Spec icon="cloud-download-outline" label="Size" value={formatSize(model.sizeMb)} />
          <Spec icon="build-outline" label="Developer" value={model.developer} />
          <Spec icon="git-branch-outline" label="Version" value={model.version} />
        </View>

        {/* About */}
        <Card>
          <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.sm }]}>About</Text>
          <Text style={[typography.body, { color: colors.textSecondary }]}>{model.description}</Text>
        </Card>

        {/* Capabilities */}
        <Card>
          <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.md }]}>Capabilities</Text>
          <View style={styles.caps}>
            {model.capabilities.map((c) => (
              <Badge key={c} label={c} />
            ))}
          </View>
        </Card>
      </ScrollView>

      {/* Sticky bottom action */}
      <View
        style={[
          styles.footer,
          { backgroundColor: colors.background, borderTopColor: colors.cardBorder, paddingBottom: insets.bottom + spacing.md, paddingHorizontal: spacing.xl },
        ]}
      >
        {install.status === "downloading" ? (
          <DownloadProgress progress={install.progress} label={`Downloading ${model.name}…`} />
        ) : install.status === "installed" ? (
          <Button testID="model-remove" label="Remove model" icon="trash-outline" variant="outline" onPress={remove} />
        ) : (
          <Button
            testID="model-download-cta"
            label={model.price === 0 ? "Download" : `Get for ${formatPrice(model.price)}`}
            icon="download-outline"
            variant="solid"
            onPress={download}
          />
        )}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", paddingTop: 8 },
  heroLogo: { padding: 14 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14, justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  spec: { width: "47.5%", flexGrow: 1 },
  caps: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, borderTopWidth: 1, paddingTop: 14 },
});
