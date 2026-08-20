import { StatusBar } from "expo-status-bar";
import React from "react";

import { useTheme } from "@/src/theme";

export const ThemedStatusBar: React.FC = () => {
  const { mode } = useTheme();
  return <StatusBar style={mode === "dark" ? "light" : "dark"} />;
};
