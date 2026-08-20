// Theme barrel + ThemeProvider/useTheme. Default mode is LIGHT (matches Figma).
// Dark palette is prepared so it can be toggled later without touching components.

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";

import { ColorTokens, palettes, progressGradient, ThemeMode } from "./colors";
import { radius } from "./radius";
import { shadows } from "./shadows";
import { spacing } from "./spacing";
import { fonts, typography } from "./typography";

export { fonts, typography } from "./typography";
export { spacing } from "./spacing";
export { radius } from "./radius";
export { shadows } from "./shadows";
export { progressGradient } from "./colors";
export type { ColorTokens, ThemeMode } from "./colors";

export type Theme = {
  mode: ThemeMode;
  colors: ColorTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  shadows: typeof shadows;
  typography: typeof typography;
  fonts: typeof fonts;
  progressGradient: string[];
};

type ThemeContextValue = Theme & {
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
};

const buildTheme = (mode: ThemeMode): Theme => ({
  mode,
  colors: palettes[mode],
  spacing,
  radius,
  shadows,
  typography,
  fonts,
  progressGradient,
});

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{
  children: React.ReactNode;
  initialMode?: ThemeMode;
}> = ({ children, initialMode = "light" }) => {
  const [mode, setMode] = useState<ThemeMode>(initialMode);

  const toggleMode = useCallback(
    () => setMode((m) => (m === "light" ? "dark" : "light")),
    [],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ ...buildTheme(mode), setMode, toggleMode }),
    [mode, toggleMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
};
