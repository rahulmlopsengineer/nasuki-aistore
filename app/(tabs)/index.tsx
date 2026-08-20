import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TAB_BAR_SPACE } from "@/src/components/navigation/BottomNavigation";
import {
  Card,
  IconButton,
  LoadingIndicator,
  Logo,
  ModelCard,
  ScreenContainer,
  SectionHeader,
  Touchable,
} from "@/src/components/ui";
import { CREDITS } from "@/src/constants/config";
import { useToast } from "@/src/hooks/use-toast";
import { CreditService, ModelService } from "@/src/services";
import { AIModel, CreditWallet, InstalledModel } from "@/src/types";
import { useTheme } from "@/src/theme";

export default function Home() {
  const { colors, radius, spacing, typography, shadows, fonts } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [wallet, setWallet] = useState<CreditWallet | null>(null);
  const [models, setModels] = useState<AIModel[]>([]);
  const [installs, setInstalls] = useState<Record<string, InstalledModel>>({});

  const load = useCallback(async () => {
    const [w, m, states] = await Promise.all([
      CreditService.getWallet(),
      ModelService.listModels(),
      ModelService.listInstallStates(),
    ]);
    setWallet(w);
    setModels(m);
    setInstalls(Object.fromEntries(states.map((s) => [s.modelId, s])));
    setLoading(false);
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

      {loading || !wallet ? (
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
          {/* Credit balance pill */}
          <Animated.View entering={FadeInDown.duration(300)}>
            <Touchable
              testID="home-credit-pill"
              onPress={() => router.push("/credits")}
              scaleTo={0.98}
              haptic={false}
              style={[
                styles.balance,
                { backgroundColor: colors.card, borderRadius: radius.pill },
              ]}
              accessibilityLabel={`${wallet.balance} credits. Open credits`}
            >
              <View style={[styles.balanceLogo, { backgroundColor: colors.background }]}>
                <Logo size={40} />
              </View>
              <Text style={[typography.display, { color: colors.text, fontFamily: fonts.bold }]}>
                {wallet.balance}
              </Text>
              <Text style={[typography.label, { color: colors.textSecondary, marginLeft: 6 }]}>
                credits
              </Text>
              <View style={{ flex: 1 }} />
              <Ionicons name="chevron-forward" size={20} color={colors.textTertiary} style={{ marginRight: 12 }} />
            </Touchable>
          </Animated.View>

          {/* Watch ads for credits */}
          <Animated.View entering={FadeInDown.delay(60).duration(300)} style={{ marginTop: spacing.xl }}>
            <Card style={styles.actionCard}>
              <View style={styles.actionText}>
                <Text style={[typography.h3, { color: colors.text }]}>watch ads for credits</Text>
                <Text style={[typography.small, { color: colors.textSecondary, marginTop: 4 }]}>
                  1 credit = {CREDITS.messagesPerCredit} messages
                </Text>
              </View>
              <IconButton
                testID="home-watch-ad"
                icon="play"
                onPress={() => router.push("/credits")}
                accessibilityLabel="Watch ad for credits"
              />
            </Card>
          </Animated.View>

          {/* Unlimited chat / buy one time */}
          <Animated.View entering={FadeInDown.delay(120).duration(300)} style={{ marginTop: spacing.lg }}>
            <Card style={styles.actionCard}>
              <View style={styles.actionText}>
                <Text style={[typography.h2, { color: colors.text }]}>Unlimited chat</Text>
                <Text style={[typography.small, { color: colors.textSecondary, marginTop: 2 }]}>
                  Buy one time
                </Text>
              </View>
              <IconButton
                testID="home-buy"
                icon="cart"
                onPress={() => router.push("/credits")}
                accessibilityLabel="Buy unlimited chat"
              />
            </Card>
          </Animated.View>

          {/* AI Models */}
          <SectionHeader
            title="Ai Models"
            centered
            style={{ marginTop: spacing.x3l, marginBottom: spacing.lg }}
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
  balance: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    paddingRight: 4,
    gap: 12,
  },
  balanceLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  actionCard: { flexDirection: "row", alignItems: "center" },
  actionText: { flex: 1, paddingRight: 12 },
});
