// Elevation / shadow tokens. Cross-platform (iOS shadow + Android elevation).
import { Platform, ViewStyle } from "react-native";

const make = (
  y: number,
  blur: number,
  opacity: number,
  elevation: number,
): ViewStyle =>
  Platform.select({
    ios: {
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: y },
      shadowOpacity: opacity,
      shadowRadius: blur,
    },
    android: { elevation },
    default: {},
  }) as ViewStyle;

export const shadows = {
  none: {} as ViewStyle,
  sm: make(2, 6, 0.06, 2),
  md: make(6, 16, 0.08, 5),
  lg: make(12, 24, 0.12, 10),
  nav: make(-2, 20, 0.14, 16),
};

export type ShadowKey = keyof typeof shadows;
