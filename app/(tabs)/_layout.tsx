import { Redirect, Tabs } from "expo-router";
import React from "react";

import { BottomNavigation } from "@/src/components/navigation/BottomNavigation";
import { LoadingIndicator, ScreenContainer } from "@/src/components/ui";
import { useAuth } from "@/src/hooks/use-auth";

export default function TabsLayout() {
  const { user, initializing } = useAuth();

  if (initializing) {
    return (
      <ScreenContainer>
        <LoadingIndicator fullscreen />
      </ScreenContainer>
    );
  }

  // Protected group — bounce unauthenticated users to login.
  if (!user) return <Redirect href="/(auth)/login" />;

  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BottomNavigation {...props} />}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="chat" />
      <Tabs.Screen name="models" />
      <Tabs.Screen name="rag" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
