import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { lightPalette as p } from "@/lib/theme";

type Props = {
  progress: number;
  size?: number;
  stroke?: number;
  color?: string;
  trackColor?: string;
  labelColor?: string;
  showLabel?: boolean;
};

export function ProgressRing({
  progress,
  size = 64,
  stroke = 6,
  color = p.clay,
  trackColor = "rgba(255,255,255,0.35)",
  labelColor = "#fff",
  showLabel = true,
}: Props) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={stroke} fill="none" />
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        </G>
      </Svg>
      {showLabel ? (
        <Text style={{ color: labelColor, fontWeight: "800", fontSize: Math.max(10, size * 0.22) }}>
          {Math.round(pct)}%
        </Text>
      ) : null}
    </View>
  );
}
