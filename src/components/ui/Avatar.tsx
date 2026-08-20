import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/src/theme";

type Props = {
  name: string;
  size?: number;
  uri?: string;
  testID?: string;
};

const initials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");

export const Avatar: React.FC<Props> = ({ name, size = 44, testID }) => {
  const { colors, fonts } = useTheme();
  return (
    <View
      testID={testID}
      accessibilityLabel={`${name} avatar`}
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.text,
        },
      ]}
    >
      <Text style={{ color: colors.textInverse, fontFamily: fonts.bold, fontSize: size * 0.38 }}>
        {initials(name) || "?"}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
});
