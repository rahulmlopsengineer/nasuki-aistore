// Typography tokens. Font family is Space Grotesk (loaded in app/_layout.tsx),
// a geometric techy sans that matches the NASUKI wordmark.

import { TextStyle } from "react-native";

export const fonts = {
  regular: "SpaceGrotesk-Regular",
  medium: "SpaceGrotesk-Medium",
  semibold: "SpaceGrotesk-SemiBold",
  bold: "SpaceGrotesk-Bold",
} as const;

export type TypographyVariant =
  | "display"
  | "h1"
  | "h2"
  | "h3"
  | "title"
  | "body"
  | "bodyStrong"
  | "small"
  | "caption"
  | "label"
  | "button";

export const typography: Record<TypographyVariant, TextStyle> = {
  display: { fontFamily: fonts.bold, fontSize: 34, lineHeight: 40, letterSpacing: 0.5 },
  h1: { fontFamily: fonts.bold, fontSize: 26, lineHeight: 32 },
  h2: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28 },
  h3: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 24 },
  title: { fontFamily: fonts.semibold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  caption: { fontFamily: fonts.regular, fontSize: 11, lineHeight: 15 },
  label: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0.3 },
  button: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 20, letterSpacing: 0.5 },
};
