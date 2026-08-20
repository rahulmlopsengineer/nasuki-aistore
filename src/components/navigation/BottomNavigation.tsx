import { Ionicons } from "@expo/vector-icons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import * as Haptics from "expo-haptics";
import React from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, { useAnimatedStyle, useDerivedValue, withSpring } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/src/theme";

// Vertical space the floating tab bar occupies — screens pad their scroll
// content by this so nothing hides behind the bar.
export const TAB_BAR_SPACE = 96;

const ICONS: Record<string, { on: keyof typeof Ionicons.glyphMap; off: keyof typeof Ionicons.glyphMap; label: string }> = {
  index: { on: "home", off: "home-outline", label: "Home" },
  chat: { on: "chatbubble", off: "chatbubble-outline", label: "Chats" },
  models: { on: "cube", off: "cube-outline", label: "Models" },
  rag: { on: "document-text", off: "document-text-outline", label: "Docs" },
  profile: { on: "person", off: "person-outline", label: "Profile" },
};

const TabSlot: React.FC<{
  focused: boolean;
  routeName: string;
  onPress: () => void;
}> = ({ focused, routeName, onPress }) => {
  const { colors, shadows } = useTheme();
  const conf = ICONS[routeName];

  const lift = useDerivedValue(() => withSpring(focused ? 1 : 0, { damping: 16, stiffness: 180 }));
  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -22 * lift.value }, { scale: 0.85 + 0.15 * lift.value }],
    opacity: lift.value,
  }));

  return (
    <Pressable
      testID={`tab-${routeName}`}
      onPress={onPress}
      style={styles.slot}
      accessibilityRole="button"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={conf?.label ?? routeName}
    >
      {/* Floating raised circle for the active tab */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.bubble,
          shadows.md,
          { backgroundColor: colors.navActiveBg },
          bubbleStyle,
        ]}
      >
        <Ionicons name={conf?.on ?? "ellipse"} size={24} color={colors.navActiveIcon} />
      </Animated.View>

      {/* Inactive icon sitting inside the bar */}
      {!focused && (
        <Ionicons name={conf?.off ?? "ellipse-outline"} size={24} color={colors.navIconInactive} />
      )}
    </Pressable>
  );
};

export const BottomNavigation: React.FC<BottomTabBarProps> = ({ state, navigation }) => {
  const { colors, radius, shadows } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[styles.wrap, { bottom: Math.max(insets.bottom, 10) + 6 }]}
      pointerEvents="box-none"
    >
      <View
        testID="bottom-navigation"
        style={[
          styles.bar,
          shadows.nav,
          { backgroundColor: colors.navBg, borderRadius: radius.pill },
        ]}
      >
        {state.routes.map((route, i) => {
          const focused = state.index === i;
          const onPress = () => {
            if (Platform.OS !== "web") {
              Haptics.selectionAsync().catch(() => {});
            }
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <TabSlot key={route.key} routeName={route.name} focused={focused} onPress={onPress} />
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 20, right: 20, alignItems: "center" },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    height: 66,
    width: "100%",
    paddingHorizontal: 10,
  },
  slot: { flex: 1, alignItems: "center", justifyContent: "center", height: "100%" },
  bubble: {
    position: "absolute",
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
});
