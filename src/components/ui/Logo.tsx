// NASUKI logo — hexagon "network" mark reproduced with SVG so it scales
// crisply at any size. Two variants: "mark" (outline) and "badge" (dark
// rounded-square containing a light mark, as on the splash screen).

import React from "react";
import { View } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";

import { useTheme } from "@/src/theme";

type Props = {
  size?: number;
  variant?: "mark" | "badge";
  color?: string; // mark color for "mark" variant
};

const NODES: { x: number; y: number; r: number }[] = [
  { x: 50, y: 47, r: 5 }, // center
  { x: 50, y: 26, r: 4 }, // top
  { x: 69, y: 40, r: 4 }, // upper right
  { x: 63, y: 66, r: 4 }, // lower right
  { x: 37, y: 66, r: 4 }, // lower left
  { x: 31, y: 40, r: 4 }, // upper left
];

const Mark: React.FC<{ stroke: string; fill: string }> = ({ stroke, fill }) => (
  <>
    <Path
      d="M88 50 L69 83 L31 83 L12 50 L31 17 L69 17 Z"
      stroke={stroke}
      strokeWidth={6}
      strokeLinejoin="round"
      fill="none"
    />
    {NODES.slice(1).map((n, i) => (
      <Line
        key={`l-${i}`}
        x1={NODES[0].x}
        y1={NODES[0].y}
        x2={n.x}
        y2={n.y}
        stroke={stroke}
        strokeWidth={4}
        strokeLinecap="round"
      />
    ))}
    {NODES.map((n, i) => (
      <Circle key={`c-${i}`} cx={n.x} cy={n.y} r={n.r} fill={fill} />
    ))}
  </>
);

export const Logo: React.FC<Props> = ({ size = 96, variant = "mark", color }) => {
  const { colors } = useTheme();

  if (variant === "badge") {
    return (
      <View accessibilityRole="image" accessibilityLabel="NASUKI logo">
        <Svg width={size} height={size} viewBox="0 0 100 100">
          <Rect x={2} y={2} width={96} height={96} rx={26} fill="#17171A" />
          <Mark stroke="#FFFFFF" fill="#FFFFFF" />
        </Svg>
      </View>
    );
  }

  const stroke = color ?? colors.text;
  return (
    <View accessibilityRole="image" accessibilityLabel="NASUKI logo">
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Mark stroke={stroke} fill={stroke} />
      </Svg>
    </View>
  );
};
