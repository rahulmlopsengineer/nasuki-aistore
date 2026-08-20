import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Modal as RNModal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";

import { useTheme } from "@/src/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  testID?: string;
};

export const Modal: React.FC<Props> = ({ visible, onClose, title, children, testID }) => {
  const { colors, radius, spacing, typography, shadows } = useTheme();

  return (
    <RNModal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View entering={FadeIn.duration(150)} style={styles.backdropWrap}>
        <Pressable
          testID="modal-backdrop"
          style={[styles.backdrop, { backgroundColor: colors.overlay }]}
          onPress={onClose}
        />
        <Animated.View
          entering={ZoomIn.duration(180)}
          testID={testID ?? "app-modal"}
          style={[
            styles.card,
            shadows.lg,
            { backgroundColor: colors.background, borderRadius: radius.xl, padding: spacing.xxl },
          ]}
        >
          {!!title && (
            <View style={styles.header}>
              <Text style={[typography.h3, { color: colors.text }]}>{title}</Text>
              <Pressable onPress={onClose} hitSlop={8} accessibilityLabel="Close">
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </Pressable>
            </View>
          )}
          {children}
        </Animated.View>
      </Animated.View>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  backdropWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  backdrop: { ...StyleSheet.absoluteFillObject },
  card: { width: "100%", maxWidth: 420 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
});
