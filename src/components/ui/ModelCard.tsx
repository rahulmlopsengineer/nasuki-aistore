import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/src/theme";
import { AIModel, InstalledModel } from "@/src/types";
import { formatSize } from "@/src/utils/format";
import { Card } from "./Card";
import { IconButton } from "./IconButton";
import { ProgressBar } from "./ProgressBar";

type Props = {
  model: AIModel;
  install: InstalledModel;
  onPress?: () => void;
  onDownload?: () => void;
  subtitle?: string;
  testID?: string;
};

export const ModelCard: React.FC<Props> = ({
  model,
  install,
  onPress,
  onDownload,
  subtitle,
  testID,
}) => {
  const { colors, spacing, typography } = useTheme();
  const status = install.status;
  const sub = subtitle ?? `minimum RAM ${model.minRamGb}GB required`;

  return (
    <Card testID={testID ?? `model-card-${model.id}`} onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <View style={styles.info}>
          <Text style={[typography.h3, { color: colors.text }]}>{model.name}</Text>
          {status !== "installed" && (
            <Text
              style={[typography.small, { color: colors.textSecondary, marginTop: 2 }]}
              numberOfLines={1}
            >
              {sub} · {formatSize(model.sizeMb)}
            </Text>
          )}
        </View>

        {status === "installed" ? (
          <View
            testID={`model-installed-${model.id}`}
            style={[styles.check, { backgroundColor: colors.circle }]}
          >
            <Ionicons name="checkmark" size={22} color={colors.circleIcon} />
          </View>
        ) : (
          <IconButton
            testID={`model-download-${model.id}`}
            icon={status === "downloading" ? "cloud-download" : "download-outline"}
            onPress={onDownload}
            disabled={status === "downloading"}
            size={48}
            accessibilityLabel={`Download ${model.name}`}
          />
        )}
      </View>

      {status === "downloading" && (
        <ProgressBar
          testID={`model-progress-${model.id}`}
          progress={install.progress}
          gradient
          height={8}
          style={{ marginTop: spacing.lg }}
        />
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {},
  row: { flexDirection: "row", alignItems: "center" },
  info: { flex: 1, paddingRight: 12 },
  check: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
});
