import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card, Header, ScreenContainer, SettingRow } from "@/src/components/ui";
import { useToast } from "@/src/hooks/use-toast";
import { useTheme } from "@/src/theme";

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const { colors, spacing, typography } = useTheme();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={[typography.label, { color: colors.textSecondary, marginLeft: 4 }]}>
        {title.toUpperCase()}
      </Text>
      <Card padded={false} style={{ paddingHorizontal: spacing.lg, paddingVertical: 4 }}>
        {children}
      </Card>
    </View>
  );
};

export default function Settings() {
  const { colors, spacing, mode, toggleMode } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [offlineMode, setOfflineMode] = useState(true);
  const [notifications, setNotifications] = useState(false);
  const [analytics, setAnalytics] = useState(false);
  const [appLock, setAppLock] = useState(false);

  return (
    <ScreenContainer testID="settings-screen">
      <Header title="Settings" showBack />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: spacing.xl,
          paddingBottom: insets.bottom + spacing.xl,
          gap: spacing.xl,
        }}
      >
        <Section title="Appearance">
          <SettingRow
            testID="setting-dark"
            icon="moon-outline"
            label="Dark mode"
            subtitle="Match the Figma dark theme"
            toggle
            toggleValue={mode === "dark"}
            onToggle={toggleMode}
          />
          <SettingRow
            testID="setting-language"
            icon="language-outline"
            label="Language"
            value="English"
            onPress={() => toast.show("Language options coming soon", "info")}
          />
        </Section>

        <Section title="Local AI">
          <SettingRow
            testID="setting-model"
            icon="cube-outline"
            label="Default model"
            value="Gamma"
            onPress={() => toast.show("Choose from the Model Store", "info")}
          />
          <SettingRow
            testID="setting-offline"
            icon="cloud-offline-outline"
            label="Offline mode"
            subtitle="Run models without any network"
            toggle
            toggleValue={offlineMode}
            onToggle={setOfflineMode}
          />
        </Section>

        <Section title="Privacy & Data">
          <SettingRow
            testID="setting-analytics"
            icon="analytics-outline"
            label="Anonymous analytics"
            toggle
            toggleValue={analytics}
            onToggle={setAnalytics}
          />
          <SettingRow
            testID="setting-cloud"
            icon="cloud-upload-outline"
            label="Cloud sync"
            value="Off"
            onPress={() => toast.show("Cloud sync arrives in a later phase", "info")}
          />
          <SettingRow
            testID="setting-storage"
            icon="server-outline"
            label="Storage"
            value="1.8 GB used"
            onPress={() => toast.show("Storage manager coming soon", "info")}
          />
        </Section>

        <Section title="Notifications & Security">
          <SettingRow
            testID="setting-notifications"
            icon="notifications-outline"
            label="Notifications"
            toggle
            toggleValue={notifications}
            onToggle={setNotifications}
          />
          <SettingRow
            testID="setting-lock"
            icon="finger-print-outline"
            label="App lock"
            subtitle="Require biometrics to open"
            toggle
            toggleValue={appLock}
            onToggle={setAppLock}
          />
        </Section>
      </ScrollView>
    </ScreenContainer>
  );
}
