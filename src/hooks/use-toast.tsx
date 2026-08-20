// Toast context — a lightweight, animated toast mounted at the app root so it
// always renders above tabs, modals and sheets. Use instead of Alert.

import { Ionicons } from "@expo/vector-icons";
import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/src/theme";

export type ToastType = "success" | "error" | "info";

type ToastState = { message: string; type: ToastType } | null;

type ToastContextValue = {
  show: (message: string, type?: ToastType) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const ICON: Record<ToastType, keyof typeof Ionicons.glyphMap> = {
  success: "checkmark-circle",
  error: "alert-circle",
  info: "information-circle",
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { colors, radius, typography, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState>(null);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-20);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (message: string, type: ToastType = "info") => {
      if (timer.current) clearTimeout(timer.current);
      setToast({ message, type });
      opacity.value = withTiming(1, { duration: 200 });
      translateY.value = withTiming(0, { duration: 220 });
      timer.current = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 220 });
        translateY.value = withTiming(-20, { duration: 220 });
        setTimeout(() => setToast(null), 240);
      }, 2600);
    },
    [opacity, translateY],
  );

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const tint: Record<ToastType, string> = {
    success: colors.success,
    error: colors.danger,
    info: colors.info,
  };

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.wrap,
            { top: insets.top + 8 },
            animStyle,
          ]}
        >
          <View
            testID="app-toast"
            style={[
              styles.toast,
              shadows.lg,
              { backgroundColor: colors.text, borderRadius: radius.pill },
            ]}
          >
            <Ionicons name={ICON[toast.type]} size={18} color={tint[toast.type]} />
            <Text
              numberOfLines={2}
              style={[typography.bodyStrong, { color: colors.textInverse, flexShrink: 1 }]}
            >
              {toast.message}
            </Text>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextValue => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
};

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
    zIndex: 1000,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 18,
    maxWidth: "100%",
  },
});
