import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { TAB_BAR_SPACE } from "@/src/components/navigation/BottomNavigation";
import {
  ErrorState,
  LoadingIndicator,
  ModelCard,
  Touchable,
} from "@/src/components/ui";
import { useToast } from "@/src/hooks/use-toast";
import { ModelService } from "@/src/services";
import { AIModel, InstalledModel, LoadState } from "@/src/types";
import { useTheme } from "@/src/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Filter = "all" | "featured" | "free" | "installed";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All models" },
  { key: "featured", label: "Featured" },
  { key: "free", label: "Free" },
  { key: "installed", label: "Installed" },
];

export default function ModelStore() {
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();

  const [state, setState] = useState<LoadState>("loading");
  const [models, setModels] = useState<AIModel[]>([]);
  const [installs, setInstalls] = useState<Record<string, InstalledModel>>({});
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    try {
      setState("loading");
      const [m, states] = await Promise.all([
        ModelService.listModels(),
        ModelService.listInstallStates(),
      ]);
      setModels(m);
      setInstalls(Object.fromEntries(states.map((s) => [s.modelId, s])));
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const getInstall = (id: string): InstalledModel =>
    installs[id] ?? { modelId: id, status: "not_installed", progress: 0 };

  const download = useCallback(
    async (model: AIModel) => {
      setInstalls((p) => ({ ...p, [model.id]: { modelId: model.id, status: "downloading", progress: 0 } }));
      await ModelService.download(model.id, (progress) => {
        setInstalls((p) => ({ ...p, [model.id]: { modelId: model.id, status: "downloading", progress } }));
      });
      setInstalls((p) => ({ ...p, [model.id]: { modelId: model.id, status: "installed", progress: 1 } }));
      toast.show(`${model.name} installed`, "success");
    },
    [toast],
  );

  const visible = useMemo(() => {
    return models.filter((m) => {
      if (filter === "featured") return m.featured;
      if (filter === "free") return m.price === 0;
      if (filter === "installed") return getInstall(m.id).status === "installed";
      return true;
    });
  }, [models, filter, installs]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Sticky header + chips */}
      <View style={{ paddingTop: insets.top + spacing.sm }}>
        <Text style={[typography.h2, { color: colors.text, textAlign: "center" }]}>Model Store</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipsContent}
          style={styles.chipsRow}
        >
          {FILTERS.map((f) => {
            const selected = filter === f.key;
            return (
              <Touchable
                key={f.key}
                testID={`filter-${f.key}`}
                onPress={() => setFilter(f.key)}
                haptic={false}
                scaleTo={0.96}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? colors.text : colors.card,
                    borderRadius: radius.pill,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={f.label}
              >
                <Text
                  style={[
                    typography.label,
                    { color: selected ? colors.textInverse : colors.textSecondary },
                  ]}
                >
                  {f.label}
                </Text>
              </Touchable>
            );
          })}
        </ScrollView>
      </View>

      {state === "loading" ? (
        <LoadingIndicator fullscreen label="Loading models…" />
      ) : state === "error" ? (
        <ErrorState onRetry={load} />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: spacing.xl,
            paddingTop: spacing.md,
            paddingBottom: TAB_BAR_SPACE + spacing.xl,
            gap: spacing.md,
          }}
        >
          {visible.map((m) => (
            <ModelCard
              key={m.id}
              model={m}
              install={getInstall(m.id)}
              onPress={() => router.push(`/models/${m.id}`)}
              onDownload={() => download(m)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  chipsRow: { marginTop: 12, height: 56 },
  chipsContent: { paddingHorizontal: 20, gap: 10, alignItems: "center" },
  chip: {
    height: 36,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
});
