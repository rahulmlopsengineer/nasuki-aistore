import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Badge,
  Card,
  Divider,
  Header,
  LoadingIndicator,
  Logo,
  ScreenContainer,
  Touchable,
} from "@/src/components/ui";
import { useToast } from "@/src/hooks/use-toast";
import { CreditService } from "@/src/services";
import { CreditTransaction, CreditWallet } from "@/src/types";
import { useTheme } from "@/src/theme";
import { relativeTime } from "@/src/utils/format";

const PACKS = [
  { credits: 50, price: "$1.99", tone: "neutral" as const },
  { credits: 150, price: "$3.99", tone: "accent" as const, best: true },
  { credits: 500, price: "$9.99", tone: "neutral" as const },
];

const TX_ICON: Record<CreditTransaction["type"], keyof typeof Ionicons.glyphMap> = {
  purchase: "card-outline",
  reward_ad: "play-circle-outline",
  usage: "chatbubble-outline",
  bonus: "gift-outline",
};

export default function Credits() {
  const { colors, radius, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [wallet, setWallet] = useState<CreditWallet | null>(null);
  const [txns, setTxns] = useState<CreditTransaction[]>([]);
  const [watching, setWatching] = useState(false);
  const [buying, setBuying] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [w, t] = await Promise.all([
      CreditService.getWallet(),
      CreditService.listTransactions(),
    ]);
    setWallet(w);
    setTxns(t);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const watchAd = async () => {
    setWatching(true);
    const w = await CreditService.watchAdForReward();
    setWallet(w);
    setTxns(await CreditService.listTransactions());
    setWatching(false);
    toast.show("You earned 5 credits!", "success");
  };

  const buy = async (amount: number) => {
    setBuying(amount);
    const w = await CreditService.buyCredits(amount);
    setWallet(w);
    setTxns(await CreditService.listTransactions());
    setBuying(null);
    toast.show(`Added ${amount} credits`, "success");
  };

  if (!wallet) {
    return (
      <ScreenContainer>
        <Header title="Credits" showBack />
        <LoadingIndicator fullscreen />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer testID="credits-screen">
      <Header title="Credits" showBack />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingBottom: insets.bottom + spacing.xl,
          gap: spacing.lg,
        }}
      >
        {/* Balance hero */}
        <Card style={styles.hero}>
          <View style={[styles.heroLogo, { backgroundColor: colors.background }]}>
            <Logo size={44} />
          </View>
          <Text style={[typography.label, { color: colors.textSecondary, marginTop: spacing.md }]}>
            CURRENT BALANCE
          </Text>
          <Text style={[typography.display, { color: colors.text, fontSize: 48, lineHeight: 54 }]}>
            {wallet.balance}
          </Text>
          <View style={styles.heroStats}>
            <Text style={[typography.small, { color: colors.textSecondary }]}>
              Earned {wallet.lifetimeEarned}
            </Text>
            <View style={[styles.dot, { backgroundColor: colors.textTertiary }]} />
            <Text style={[typography.small, { color: colors.textSecondary }]}>
              Spent {wallet.lifetimeSpent}
            </Text>
          </View>
        </Card>

        {/* Watch ad */}
        <Card testID="watch-ad-card" onPress={watching ? undefined : watchAd} style={styles.actionRow}>
          <View style={[styles.actionIcon, { backgroundColor: colors.circle }]}>
            <Ionicons name="play" size={20} color={colors.circleIcon} />
          </View>
          <View style={{ flex: 1, paddingHorizontal: spacing.md }}>
            <Text style={[typography.title, { color: colors.text }]}>Watch ads for credits</Text>
            <Text style={[typography.small, { color: colors.textSecondary }]}>+5 credits per ad · 1 credit = 20 messages</Text>
          </View>
          {watching ? <LoadingIndicator style={{ padding: 0 }} /> : <Badge label="+5" tone="success" />}
        </Card>

        {/* Buy credits */}
        <Text style={[typography.h3, { color: colors.text, marginTop: spacing.sm }]}>Buy credits</Text>
        <View style={{ gap: spacing.md }}>
          {PACKS.map((p) => (
            <Touchable
              key={p.credits}
              testID={`buy-${p.credits}`}
              onPress={() => (buying ? undefined : buy(p.credits))}
              scaleTo={0.98}
              style={[
                styles.pack,
                {
                  backgroundColor: p.best ? colors.accentSoft : colors.card,
                  borderRadius: radius.lg,
                },
              ]}
              accessibilityLabel={`Buy ${p.credits} credits for ${p.price}`}
            >
              <Ionicons name="diamond-outline" size={22} color={p.best ? colors.accentOn : colors.text} />
              <View style={{ flex: 1, paddingHorizontal: spacing.md }}>
                <Text style={[typography.title, { color: p.best ? colors.accentOn : colors.text }]}>
                  {p.credits} credits
                </Text>
                {p.best && <Text style={[typography.caption, { color: colors.accentOn }]}>Best value</Text>}
              </View>
              <Text style={[typography.title, { color: p.best ? colors.accentOn : colors.text }]}>
                {buying === p.credits ? "…" : p.price}
              </Text>
            </Touchable>
          ))}
        </View>

        {/* Transactions */}
        <Text style={[typography.h3, { color: colors.text, marginTop: spacing.sm }]}>History</Text>
        <Card padded={false} style={{ paddingHorizontal: spacing.lg }}>
          {txns.map((t, i) => (
            <View key={t.id}>
              {i > 0 && <Divider />}
              <View style={styles.txRow}>
                <View style={[styles.txIcon, { backgroundColor: colors.background, borderRadius: radius.md }]}>
                  <Ionicons name={TX_ICON[t.type]} size={18} color={colors.text} />
                </View>
                <View style={{ flex: 1, paddingHorizontal: spacing.md }}>
                  <Text style={[typography.bodyStrong, { color: colors.text }]}>{t.label}</Text>
                  <Text style={[typography.caption, { color: colors.textSecondary }]}>
                    {relativeTime(t.createdAt)}
                  </Text>
                </View>
                <Text
                  style={[
                    typography.title,
                    { color: t.amount >= 0 ? colors.success : colors.text },
                  ]}
                >
                  {t.amount >= 0 ? "+" : ""}
                  {t.amount}
                </Text>
              </View>
            </View>
          ))}
        </Card>
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", paddingVertical: 24 },
  heroLogo: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  heroStats: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  dot: { width: 3, height: 3, borderRadius: 2 },
  actionRow: { flexDirection: "row", alignItems: "center" },
  actionIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  pack: { flexDirection: "row", alignItems: "center", padding: 16 },
  txRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12 },
  txIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
});
