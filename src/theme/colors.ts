// Centralized color tokens — single source of truth for NASUKI.
// Figma is a LIGHT-first monochrome design with a salmon/coral accent.
// A dark palette is prepared so dark mode can be added later without
// rewriting components (all components read colors via useTheme()).

export type ColorTokens = {
  // surfaces
  background: string;
  card: string;
  cardAlt: string;
  cardBorder: string;
  overlay: string;

  // text
  text: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;

  // brand / accent
  accent: string; // coral-red (text / active)
  accentSoft: string; // salmon (button fill)
  accentOn: string; // text/icon on accentSoft

  // controls
  circle: string; // gray circular icon buttons
  circleIcon: string;

  // bottom navigation
  navBg: string;
  navIcon: string;
  navIconInactive: string;
  navActiveBg: string;
  navActiveIcon: string;

  // status
  success: string;
  danger: string;
  warning: string;
  info: string;

  // misc
  skeleton: string;
  shadow: string;
};

export const lightColors: ColorTokens = {
  background: "#FFFFFF",
  card: "#F4F4F5",
  cardAlt: "#FAFAFA",
  cardBorder: "#ECECEE",
  overlay: "rgba(17,17,20,0.45)",

  text: "#111114",
  textSecondary: "#9B9BA1",
  textTertiary: "#C2C2C7",
  textInverse: "#FFFFFF",

  accent: "#E24A4A",
  accentSoft: "#F8CFCF",
  accentOn: "#E24A4A",

  circle: "#B9B9BE",
  circleIcon: "#2A2A2E",

  navBg: "#161618",
  navIcon: "#FFFFFF",
  navIconInactive: "#7C7C82",
  navActiveBg: "#EDEDED",
  navActiveIcon: "#161618",

  success: "#3BB273",
  danger: "#E24A4A",
  warning: "#E2A64A",
  info: "#4F86E6",

  skeleton: "#E9E9EB",
  shadow: "#000000",
};

export const darkColors: ColorTokens = {
  background: "#0E0E10",
  card: "#1A1A1D",
  cardAlt: "#141416",
  cardBorder: "#26262A",
  overlay: "rgba(0,0,0,0.6)",

  text: "#F5F5F7",
  textSecondary: "#9B9BA1",
  textTertiary: "#5E5E64",
  textInverse: "#111114",

  accent: "#F16A6A",
  accentSoft: "#3A2626",
  accentOn: "#F8CFCF",

  circle: "#2E2E33",
  circleIcon: "#F5F5F7",

  navBg: "#000000",
  navIcon: "#FFFFFF",
  navIconInactive: "#6A6A70",
  navActiveBg: "#26262A",
  navActiveIcon: "#FFFFFF",

  success: "#3BB273",
  danger: "#F16A6A",
  warning: "#E2A64A",
  info: "#4F86E6",

  skeleton: "#1F1F22",
  shadow: "#000000",
};

// Rainbow gradient used for the model download progress bar (from Figma).
export const progressGradient = [
  "#F49AC1",
  "#B57BE0",
  "#7B8BE6",
  "#4FC3D9",
  "#57D39A",
];

export type ThemeMode = "light" | "dark";

export const palettes: Record<ThemeMode, ColorTokens> = {
  light: lightColors,
  dark: darkColors,
};
