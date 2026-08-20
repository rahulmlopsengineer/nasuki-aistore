import React from "react";
import {
  Modal as RNModal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import Animated, { FadeIn, SlideInDown, SlideOutDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/src/theme";

type Props = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  testID?: string;
};

export const BottomSheet: React.FC<Props> = ({
  visible,
  onClose,
  title,
  children,
  testID,
}) => {
  const { colors, radius, spacing, typography, shadows } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <RNModal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.root}>
        <Animated.View entering={FadeIn.duration(150)} style={styles.backdropWrap}>
          <Pressable
            testID="sheet-backdrop"
            style={[styles.backdrop, { backgroundColor: colors.overlay }]}
            onPress={onClose}
          />
        </Animated.View>
        <Animated.View
          entering={SlideInDown.duration(240)}
          exiting={SlideOutDown.duration(200)}
          testID={testID ?? "bottom-sheet"}
          style={[
            styles.sheet,
            shadows.lg,
            {
              backgroundColor: colors.background,
              borderTopLeftRadius: radius.xxl,
              borderTopRightRadius: radius.xxl,
              paddingHorizontal: spacing.xxl,
              paddingBottom: insets.bottom + spacing.xl,
            },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.cardBorder }]} />
          {!!title && (
            <Text style={[typography.h3, { color: colors.text, marginBottom: spacing.lg }]}>
              {title}
            </Text>
          )}
          {children}
        </Animated.View>
      </View>
    </RNModal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdropWrap: { ...StyleSheet.absoluteFillObject },
  backdrop: { flex: 1 },
  sheet: { paddingTop: 12 },
  grabber: {
    width: 44,
    height: 5,
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 16,
  },
});
