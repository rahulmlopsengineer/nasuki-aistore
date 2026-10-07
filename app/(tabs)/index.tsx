import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TAB_BAR_SPACE } from "@/src/components/navigation/BottomNavigation";
import {
  Button,
  LoadingIndicator,
  ModelCard,
  ScreenContainer,
  SectionHeader,
} from "@/src/components/ui";
import { useToast } from "@/src/hooks/use-toast";
import { ModelService } from "@/src/services";
import { AIModel, InstalledModel } from "@/src/types";
import { useTheme } from "@/src/theme";

export default function Home() {
  const { colors, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [models, setModels] = useState<AIModel[]>([]);
  const [installs, setInstalls] = useState<Record<string, InstalledModel>>({});

  const load = useCallback(async () => {
    try {
      const [m, states] = await Promise.all([
        ModelService.listModels(),
        ModelService.listInstallStates(),
      ]);
      setModels(m);
      setInstalls(Object.fromEntries(states.map((s) => [s.modelId, s])));
    } catch (e) {
      console.error("[NASUKI][HOME] Failed to load workspace:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const download = useCallback(
    async (model: AIModel) => {
      setInstalls((p) => ({
        ...p,
        [model.id]: { modelId: model.id, status: "downloading", progress: 0 },
      }));
      await ModelService.download(model.id, (progress) => {
        setInstalls((p) => ({
          ...p,
          [model.id]: { modelId: model.id, status: "downloading", progress },
        }));
      });
      setInstalls((p) => ({
        ...p,
        [model.id]: { modelId: model.id, status: "installed", progress: 1 },
      }));
      toast.show(`${model.name} installed`, "success");
    },
    [toast],
  );

  const getInstall = (id: string): InstalledModel =>
    installs[id] ?? { modelId: id, status: "not_installed", progress: 0 };

  return (
    <ScreenContainer testID="home-screen">
      <View style={{ paddingTop: insets.top + spacing.sm }}>
        <Text style={[typography.h2, styles.pageTitle, { color: colors.text }]}>Home</Text>
      </View>

      {loading ? (
        <LoadingIndicator fullscreen label="Loading your workspace…" />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.md,
            paddingBottom: TAB_BAR_SPACE + spacing.xl,
          }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
          }
        >
          <Button
            label="Open Local AI Test"
            onPress={() => router.push("/local_ai_test" as any)}
            variant="outline"
            style={{ marginBottom: spacing.md }}
          />

          {/* AI Models */}
          <SectionHeader
            title="Ai Models"
            centered
            style={{ marginTop: spacing.md, marginBottom: spacing.lg }}
          />

          <View style={{ gap: spacing.md }}>
            {models.map((m, i) => (
              <Animated.View key={m.id} entering={FadeInDown.delay(160 + i * 60).duration(300)}>
                <ModelCard
                  model={m}
                  install={getInstall(m.id)}
                  onPress={() => router.push(`/models/${m.id}`)}
                  onDownload={() => download(m)}
                />
              </Animated.View>
            ))}
          </View>
        </ScrollView>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  pageTitle: { textAlign: "center", paddingBottom: 4 },
});
