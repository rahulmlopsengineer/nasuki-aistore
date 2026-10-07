import { useRouter } from "expo-router";
import React, { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TAB_BAR_SPACE } from "@/src/components/navigation/BottomNavigation";
import {
  Avatar,
  Badge,
  BottomSheet,
  Button,
  Card,
  Divider,
  SettingRow,
} from "@/src/components/ui";
import { useAuth } from "@/src/hooks/use-auth";
import { useTheme } from "@/src/theme";

export default function Profile() {
  const { colors, spacing, typography } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [confirmLogout, setConfirmLogout] = useState(false);

  const doLogout = async () => {
    setConfirmLogout(false);
    await signOut();
    router.replace("/(auth)/login");
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.xl }}>
        <Text style={[typography.h2, { color: colors.text, textAlign: "center" }]}>Profile</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingTop: spacing.lg,
          paddingBottom: TAB_BAR_SPACE + spacing.xl,
          gap: spacing.lg,
        }}
      >
        {/* Account header */}
        <Card style={styles.account}>
          <Avatar name={user?.name ?? "Guest"} size={60} />
          <View style={{ flex: 1, paddingHorizontal: spacing.md }}>
            <Text style={[typography.h3, { color: colors.text }]} numberOfLines={1}>
              {user?.name ?? "Guest"}
            </Text>
            <Text style={[typography.small, { color: colors.textSecondary }]} numberOfLines={1}>
              {user?.email ?? "Not signed in"}
            </Text>
          </View>
          <Badge label={user?.method === "google" ? "Google" : "Demo"} tone="accent" />
        </Card>

        {/* Menu */}
        <Card padded={false} style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.xs }}>
          <SettingRow testID="menu-models" icon="cube-outline" label="Models" subtitle="Manage installed models" onPress={() => router.push("/(tabs)/models")} />
          <Divider />
          <SettingRow testID="menu-settings" icon="settings-outline" label="Settings" onPress={() => router.push("/settings")} />
          <Divider />
          <SettingRow testID="menu-privacy" icon="lock-closed-outline" label="Privacy & Security" onPress={() => router.push("/privacy")} />
          <Divider />
          <SettingRow testID="menu-feedback" icon="chatbox-ellipses-outline" label="Send Feedback" onPress={() => router.push("/feedback")} />
          <Divider />
          <SettingRow testID="menu-bug" icon="bug-outline" label="Report a Bug" onPress={() => router.push("/bug-report")} />
        </Card>

        <Button
          testID="logout-button"
          label="Log out"
          icon="log-out-outline"
          variant="outline"
          onPress={() => setConfirmLogout(true)}
        />

        <Text style={[typography.caption, { color: colors.textTertiary, textAlign: "center" }]}>
          NASUKI · Your Local AI · v1.0
        </Text>
      </ScrollView>

      <BottomSheet visible={confirmLogout} onClose={() => setConfirmLogout(false)} title="Log out?">
        <Text style={[typography.body, { color: colors.textSecondary, marginBottom: spacing.lg }]}>
          You can sign back in anytime. Your local data stays on this device.
        </Text>
        <Button testID="logout-confirm" label="Log out" variant="solid" onPress={doLogout} />
        <Button
          label="Cancel"
          variant="ghost"
          onPress={() => setConfirmLogout(false)}
          style={{ marginTop: spacing.sm }}
        />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  account: { flexDirection: "row", alignItems: "center" },
});
