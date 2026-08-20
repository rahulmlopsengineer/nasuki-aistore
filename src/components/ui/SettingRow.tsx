import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Switch, Text, View } from "react-native";

import { useTheme } from "@/src/theme";
import { Touchable } from "./Touchable";

type Props = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  toggle?: boolean;
  toggleValue?: boolean;
  onToggle?: (v: boolean) => void;
  danger?: boolean;
  testID?: string;
};

export const SettingRow: React.FC<Props> = ({
  icon,
  label,
  subtitle,
  value,
  onPress,
  toggle = false,
  toggleValue = false,
  onToggle,
  danger = false,
  testID,
}) => {
  const { colors, spacing, typography, radius } = useTheme();
  const tint = danger ? colors.danger : colors.text;

  const content = (
    <View style={styles.row}>
      <View
        style={[
          styles.iconWrap,
          { backgroundColor: colors.card, borderRadius: radius.md },
        ]}
      >
        <Ionicons name={icon} size={19} color={danger ? colors.danger : colors.text} />
      </View>
      <View style={{ flex: 1, paddingHorizontal: spacing.md }}>
        <Text style={[typography.bodyStrong, { color: tint }]}>{label}</Text>
        {!!subtitle && (
          <Text style={[typography.small, { color: colors.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </Text>
        )}
      </View>
      {toggle ? (
        <Switch
          testID={`${testID}-switch`}
          value={toggleValue}
          onValueChange={onToggle}
          trackColor={{ false: colors.skeleton, true: colors.text }}
          thumbColor={colors.background}
        />
      ) : (
        <View style={styles.trailing}>
          {!!value && (
            <Text style={[typography.small, { color: colors.textSecondary }]}>{value}</Text>
          )}
          {onPress && (
            <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
          )}
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Touchable
        testID={testID}
        onPress={onPress}
        haptic={false}
        scaleTo={0.99}
        accessibilityRole="button"
        accessibilityLabel={label}
        style={styles.touch}
      >
        {content}
      </Touchable>
    );
  }
  return (
    <View testID={testID} style={styles.touch}>
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  touch: { paddingVertical: 10 },
  row: { flexDirection: "row", alignItems: "center" },
  iconWrap: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  trailing: { flexDirection: "row", alignItems: "center", gap: 6 },
});
